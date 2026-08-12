package matching

import (
	"fmt"
	"math"
	"time"

	"github.com/RyanT04/TradeGo/internal/database"
)

// calculateLiquidationPrice returns the price at which a leveraged position
// would lose 100% of its margin.
// For LONG:  liquidation = entry × (1 - 1/leverage)
// For SHORT: liquidation = entry × (1 + 1/leverage)
func calculateLiquidationPrice(direction string, entryPrice float64, leverage int) float64 {
	lev := float64(leverage)
	if direction == "LONG" {
		return entryPrice * (1 - 1/lev)
	}
	return entryPrice * (1 + 1/lev)
}

// calculatePnL returns the profit/loss in USD for a leveraged position at the
// current price.
// For LONG:  pnl = size × ((current - entry) / entry)
// For SHORT: pnl = size × ((entry - current) / entry)
func calculatePnL(direction string, entryPrice, currentPrice, sizeUSD float64) float64 {
	if entryPrice == 0 {
		return 0
	}
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
	if math.IsNaN(marginUSD) || math.IsInf(marginUSD, 0) || marginUSD <= 0 {
		return nil, fmt.Errorf("margin must be a positive, finite number")
	}

	entryPrice, err := e.priceFor(symbol)
	if err != nil {
		return nil, err
	}

	sizeUSD := marginUSD * float64(leverage)
	liquidationPrice := calculateLiquidationPrice(direction, entryPrice, leverage)

	// Balance check, margin debit, and position insert happen in one
	// transaction with the user row locked.
	position, err := e.db.OpenLeveragedPositionTx(
		userID, symbol, direction, leverage,
		entryPrice, sizeUSD, marginUSD, liquidationPrice,
	)
	if err != nil {
		return nil, err
	}

	return &LeveragedOpenResult{
		Position: position,
		Latency:  time.Since(start),
	}, nil
}

func (e *Engine) CloseLeveragedPosition(userID, positionID string) (*LeveragedCloseResult, error) {
	start := time.Now()

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
		return nil, database.ErrPositionNotFound
	}

	closePrice, err := e.priceFor(pos.Symbol)
	if err != nil {
		return nil, err
	}

	pnl := calculatePnL(pos.Direction, pos.EntryPrice, closePrice, pos.SizeUSD)

	// The store re-checks is_open under a row lock and returns
	// ErrPositionNotFound if the liquidation worker got there first — so a
	// liquidated position can't also be refunded.
	updated, err := e.db.CloseLeveragedPositionTx(userID, positionID, closePrice, pnl)
	if err != nil {
		return nil, err
	}

	return &LeveragedCloseResult{
		Position: updated,
		PnL:      pnl,
		Latency:  time.Since(start),
	}, nil
}