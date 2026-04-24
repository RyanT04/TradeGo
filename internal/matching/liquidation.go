package matching

import (
	"log"
	"strconv"
	"time"
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

		liquidated := false
		if pos.Direction == "LONG" && price <= pos.LiquidationPrice {
			liquidated = true
		} else if pos.Direction == "SHORT" && price >= pos.LiquidationPrice {
			liquidated = true
		}

		if liquidated {
			// Liquidated = lose 100% of margin (pnl = -marginUSD)
			pnl := -pos.MarginUSD
			if err := e.db.ClosePosition(pos.ID, price, pnl); err != nil {
				log.Printf("liquidation worker: failed to close position %s: %v", pos.ID, err)
				continue
			}
			// No margin returned — user loses the whole margin
			log.Printf("LIQUIDATED: %s %s %dx @ %.2f (entry %.2f, liq %.2f, loss $%.2f)",
				pos.UserID[:8], pos.Symbol, pos.Leverage, price, pos.EntryPrice, pos.LiquidationPrice, pos.MarginUSD)
		}
	}
}
