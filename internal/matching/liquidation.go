package matching

import (
	"errors"
	"log"
	"strconv"
	"time"

	"github.com/RyanT04/TradeGo/internal/database"
)

// StartLiquidationWorker runs a background goroutine that continuously checks
// all open leveraged positions against live prices and auto-closes any that
// have hit their liquidation price.
func (e *Engine) StartLiquidationWorker() {
	go e.liquidationLoop()
	log.Println("Liquidation worker started")
}

func (e *Engine) liquidationLoop() {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		e.checkLiquidations()
	}
}

// shouldLiquidate reports whether a position has crossed its liquidation price.
// Split out from checkLiquidations so it can be tested directly.
func shouldLiquidate(direction string, price, liquidationPrice float64) bool {
	if direction == "LONG" {
		return price <= liquidationPrice
	}
	return price >= liquidationPrice
}

func (e *Engine) checkLiquidations() {
	positions, err := e.db.GetAllOpenPositions()
	if err != nil {
		log.Printf("liquidation worker: failed to get positions: %v", err)
		return
	}

	for _, pos := range positions {
		t := e.bybit.GetTicker(pos.Symbol)
		if t == nil {
			continue
		}
		price, err := strconv.ParseFloat(t.Price, 64)
		if err != nil {
			continue
		}

		if !shouldLiquidate(pos.Direction, price, pos.LiquidationPrice) {
			continue
		}

		// LiquidatePosition re-checks is_open under a row lock. If the user
		// closed the position between our read and this call, it returns
		// ErrPositionNotFound and we skip quietly rather than double-closing.
		if err := e.db.LiquidatePosition(pos.ID, price); err != nil {
			if errors.Is(err, database.ErrPositionNotFound) {
				continue
			}
			log.Printf("liquidation worker: failed to close position %s: %v", pos.ID, err)
			continue
		}

		log.Printf("LIQUIDATED: %s %s %dx @ %.2f (entry %.2f, liq %.2f, loss $%.2f)",
			shortID(pos.UserID), pos.Symbol, pos.Leverage, price,
			pos.EntryPrice, pos.LiquidationPrice, pos.MarginUSD)
	}
}