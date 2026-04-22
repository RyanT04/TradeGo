package matching

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"time"

	"golang.org/x/sync/errgroup"

	"github.com/RyanT04/TradeGo/internal/database"
	"github.com/RyanT04/TradeGo/internal/market"
	"github.com/RyanT04/TradeGo/internal/models"
)

type Engine struct {
	db    *database.DB
	bybit *market.BybitClient
}

func NewEngine(db *database.DB, bybit *market.BybitClient) *Engine {
	return &Engine{db: db, bybit: bybit}
}

type TradeResult struct {
	Trade   *models.Trade `json:"trade"`
	Latency time.Duration `json:"latency"`
}

func (e *Engine) ExecuteMarketBuy(userID, symbol string, quantity float64) (*TradeResult, error) {
	start := time.Now()

	// Step 1: Get live price (in-memory, ~microseconds)
	ticker := e.bybit.GetTicker(symbol)
	if ticker == nil {
		return nil, fmt.Errorf("no price data for %s", symbol)
	}

	price, err := strconv.ParseFloat(ticker.Price, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid price: %w", err)
	}

	total := price * quantity

	// Step 2: Check balance (must be sequential — need result before proceeding)
	user, err := e.db.GetUserByID(userID)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}
	if user.Balance < total {
		return nil, fmt.Errorf("insufficient balance: have %.2f, need %.2f", user.Balance, total)
	}

	// Step 3: Run balance deduction + holdings update concurrently
	g, ctx := errgroup.WithContext(context.Background())
	_ = ctx

	g.Go(func() error {
		return e.db.UpdateBalance(userID, -total)
	})

	g.Go(func() error {
		return e.db.UpsertHolding(userID, symbol, quantity, price)
	})

	if err := g.Wait(); err != nil {
		return nil, fmt.Errorf("failed to execute trade: %w", err)
	}

	// Step 4: Record trade asynchronously (fire and forget — doesn't affect response)
	tradeCh := make(chan *models.Trade, 1)
	go func() {
		trade, err := e.db.RecordTrade(userID, symbol, "BUY", quantity, price, total)
		if err != nil {
			log.Printf("failed to record trade: %v", err)
			tradeCh <- nil
			return
		}
		tradeCh <- trade
	}()

	// Wait for trade record (we still want it in the response)
	trade := <-tradeCh

	latency := time.Since(start)
	log.Printf("BUY executed: %s %.6f %s @ %.2f ($%.2f) in %v", userID[:8], quantity, symbol, price, total, latency)

	return &TradeResult{
		Trade:   trade,
		Latency: latency,
	}, nil
}

func (e *Engine) ExecuteMarketSell(userID, symbol string, quantity float64) (*TradeResult, error) {
	start := time.Now()

	// Step 1: Get live price
	ticker := e.bybit.GetTicker(symbol)
	if ticker == nil {
		return nil, fmt.Errorf("no price data for %s", symbol)
	}

	price, err := strconv.ParseFloat(ticker.Price, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid price: %w", err)
	}

	// Step 2: Check holdings
	holding, err := e.db.GetHolding(userID, symbol)
	if err != nil || holding.Quantity < quantity {
		return nil, fmt.Errorf("insufficient holdings")
	}

	total := price * quantity

	// Step 3: Run balance credit + holdings reduction concurrently
	g, ctx := errgroup.WithContext(context.Background())
	_ = ctx

	g.Go(func() error {
		return e.db.UpdateBalance(userID, total)
	})

	g.Go(func() error {
		return e.db.UpsertHolding(userID, symbol, -quantity, price)
	})

	if err := g.Wait(); err != nil {
		return nil, fmt.Errorf("failed to execute trade: %w", err)
	}

	// Step 4: Record trade asynchronously
	tradeCh := make(chan *models.Trade, 1)
	go func() {
		trade, err := e.db.RecordTrade(userID, symbol, "SELL", quantity, price, total)
		if err != nil {
			log.Printf("failed to record trade: %v", err)
			tradeCh <- nil
			return
		}
		tradeCh <- trade
	}()

	trade := <-tradeCh

	latency := time.Since(start)
	log.Printf("SELL executed: %s %.6f %s @ %.2f ($%.2f) in %v", userID[:8], quantity, symbol, price, total, latency)

	return &TradeResult{
		Trade:   trade,
		Latency: latency,
	}, nil
}
