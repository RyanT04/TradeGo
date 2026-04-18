package matching

import (
	"fmt"
	"log"
	"strconv"
	"time"

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

func (e *Engine) ExecuteMarketBuy(userID, symbol string, quantity float64) (*TradeResult, error) {
	start := time.Now()

	// Get live price from Bybit
	ticker := e.bybit.GetTicker(symbol)
	if ticker == nil {
		return nil, fmt.Errorf("no price data for %s", symbol)
	}

	price, err := strconv.ParseFloat(ticker.Price, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid price: %w", err)
	}

	total := price * quantity

	// Check balance
	user, err := e.db.GetUserByID(userID)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}
	if user.Balance < total {
		return nil, fmt.Errorf("insufficient balance: have %.2f, need %.2f", user.Balance, total)
	}

	// Deduct balance
	if err := e.db.UpdateBalance(userID, -total); err != nil {
		return nil, fmt.Errorf("failed to update balance: %w", err)
	}

	// Update holdings
	if err := e.db.UpsertHolding(userID, symbol, quantity, price); err != nil {
		return nil, fmt.Errorf("failed to update holding: %w", err)
	}

	// Record trade
	trade, err := e.db.RecordTrade(userID, symbol, "BUY", quantity, price, total)
	if err != nil {
		return nil, fmt.Errorf("failed to record trade: %w", err)
	}

	latency := time.Since(start)
	log.Printf("BUY executed: %s %.6f %s @ %.2f ($%.2f) in %v", userID[:8], quantity, symbol, price, total, latency)

	return &TradeResult{
		Trade:   trade,
		Latency: latency,
	}, nil
}

func (e *Engine) ExecuteMarketSell(userID, symbol string, quantity float64) (*TradeResult, error) {
	start := time.Now()

	// Get live price
	ticker := e.bybit.GetTicker(symbol)
	if ticker == nil {
		return nil, fmt.Errorf("no price data for %s", symbol)
	}

	price, err := strconv.ParseFloat(ticker.Price, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid price: %w", err)
	}

	// Check holdings
	holding, err := e.db.GetHolding(userID, symbol)
	if err != nil || holding.Quantity < quantity {
		return nil, fmt.Errorf("insufficient holdings")
	}

	total := price * quantity

	// Add balance
	if err := e.db.UpdateBalance(userID, total); err != nil {
		return nil, fmt.Errorf("failed to update balance: %w", err)
	}

	// Reduce holdings
	if err := e.db.UpsertHolding(userID, symbol, -quantity, price); err != nil {
		return nil, fmt.Errorf("failed to update holding: %w", err)
	}

	// Record trade
	trade, err := e.db.RecordTrade(userID, symbol, "SELL", quantity, price, total)
	if err != nil {
		return nil, fmt.Errorf("failed to record trade: %w", err)
	}

	latency := time.Since(start)
	log.Printf("SELL executed: %s %.6f %s @ %.2f ($%.2f) in %v", userID[:8], quantity, symbol, price, total, latency)

	return &TradeResult{
		Trade:   trade,
		Latency: latency,
	}, nil
}

type TradeResult struct {
	Trade   *models.Trade `json:"trade"`
	Latency time.Duration `json:"latency"`
}
