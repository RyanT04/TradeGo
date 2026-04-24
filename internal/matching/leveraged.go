package matching

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"golang.org/x/sync/errgroup"

	"github.com/RyanT04/TradeGo/internal/database"
)

// calculateLiquidationPrice returns the price at which a leveraged position
// would lose 100% of its margin.
// For LONG: liquidation = entry × (1 - 1/leverage)
// For SHORT: liquidation = entry × (1 + 1/leverage)
func calculateLiquidationPrice(direction string, entryPrice float64, leverage int) float64 {
	lev := float64(leverage)
	if direction == "LONG" {
		return entryPrice * (1 - 1/lev)
	}
	return entryPrice * (1 + 1/lev)
}

// calculatePnL returns the profit/loss in USD for a leveraged position at current price.
// For LONG: pnl = size × ((current - entry) / entry)
// For SHORT: pnl = size × ((entry - current) / entry)
func calculatePnL(direction string, entryPrice, currentPrice, sizeUSD float64) float64 {
	if direction == "LONG" {
		return sizeUSD * ((currentPrice - entryPrice) / entryPrice)
	}
	return sizeUSD * ((entryPrice - currentPrice) / entryPrice)
}

type LeveragedOpenResult struct {
	Position *database.LeveragedPosition `json:"position"`
	Latency  time.Duration               `json:"latency"`
}

type LeveragedCloseResult struct {
	Position *database.LeveragedPosition `json:"position"`
	PnL      float64                     `json:"pnl"`
	Latency  time.Duration               `json:"latency"`
}

func (e *Engine) OpenLeveragedPosition(userID, symbol, direction string, leverage int, marginUSD float64) (*LeveragedOpenResult, error) {
	start := time.Now()

	if direction != "LONG" && direction != "SHORT" {
		return nil, fmt.Errorf("direction must be LONG or SHORT")
	}
	if leverage < 2 || leverage > 50 {
		return nil, fmt.Errorf("leverage must be between 2x and 50x")
	}
	if marginUSD <= 0 {
		return nil, fmt.Errorf("margin must be positive")
	}

	// Get live price
	ticker := e.bybit.GetTicker(symbol)
	if ticker == nil {
		return nil, fmt.Errorf("no price data for %s", symbol)
	}
	entryPrice, err := strconv.ParseFloat(ticker.Price, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid price: %w", err)
	}

	// Check user has enough balance for margin
	user, err := e.db.GetUserByID(userID)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}
	if user.Balance < marginUSD {
		return nil, fmt.Errorf("insufficient balance: have %.2f, need %.2f", user.Balance, marginUSD)
	}

	sizeUSD := marginUSD * float64(leverage)
	liquidationPrice := calculateLiquidationPrice(direction, entryPrice, leverage)

	// Deduct margin + create position concurrently
	g, _ := errgroup.WithContext(context.Background())

	g.Go(func() error {
		return e.db.UpdateBalance(userID, -marginUSD)
	})

	var position *database.LeveragedPosition
	g.Go(func() error {
		p, err := e.db.OpenLeveragedPosition(userID, symbol, direction, leverage,
			entryPrice, sizeUSD, marginUSD, liquidationPrice)
		if err != nil {
			return err
		}
		position = p
		return nil
	})

	if err := g.Wait(); err != nil {
		return nil, fmt.Errorf("failed to open position: %w", err)
	}

	return &LeveragedOpenResult{
		Position: position,
		Latency:  time.Since(start),
	}, nil
}

func (e *Engine) CloseLeveragedPosition(userID, positionID string) (*LeveragedCloseResult, error) {
	start := time.Now()

	// Get the position to close
	positions, err := e.db.GetOpenPositions(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get positions: %w", err)
	}

	var pos *database.LeveragedPosition
	for i := range positions {
		if positions[i].ID == positionID {
			pos = &positions[i]
			break
		}
	}
	if pos == nil {
		return nil, fmt.Errorf("position not found or already closed")
	}

	// Get live price
	ticker := e.bybit.GetTicker(pos.Symbol)
	if ticker == nil {
		return nil, fmt.Errorf("no price data for %s", pos.Symbol)
	}
	closePrice, err := strconv.ParseFloat(ticker.Price, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid price: %w", err)
	}

	pnl := calculatePnL(pos.Direction, pos.EntryPrice, closePrice, pos.SizeUSD)
	returnAmount := pos.MarginUSD + pnl // margin comes back, plus or minus pnl

	// Close position + credit user concurrently
	g, _ := errgroup.WithContext(context.Background())

	g.Go(func() error {
		return e.db.ClosePosition(positionID, closePrice, pnl)
	})

	g.Go(func() error {
		return e.db.UpdateBalance(userID, returnAmount)
	})

	if err := g.Wait(); err != nil {
		return nil, fmt.Errorf("failed to close position: %w", err)
	}

	// Refresh for response
	pos.IsOpen = false
	pos.ClosePrice = &closePrice
	pos.PnL = &pnl

	return &LeveragedCloseResult{
		Position: pos,
		PnL:      pnl,
		Latency:  time.Since(start),
	}, nil
}
