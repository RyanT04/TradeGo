package matching

import (
	"github.com/RyanT04/TradeGo/internal/database"
	"github.com/RyanT04/TradeGo/internal/market"
	"github.com/RyanT04/TradeGo/internal/models"
)

// Store is the persistence surface the matching engine depends on.
//
// It exists so the engine can be tested against an in-memory fake rather than
// a live Postgres instance. *database.DB satisfies it in production.
type Store interface {
	ExecuteBuy(userID, symbol string, quantity, price float64) (*models.Trade, error)
	ExecuteSell(userID, symbol string, quantity, price float64) (*models.Trade, error)

	OpenLeveragedPositionTx(
		userID, symbol, direction string,
		leverage int,
		entryPrice, sizeUSD, marginUSD, liquidationPrice float64,
	) (*database.LeveragedPosition, error)

	CloseLeveragedPositionTx(userID, positionID string, closePrice, pnl float64) (*database.LeveragedPosition, error)
	LiquidatePosition(positionID string, closePrice float64) error

	GetOpenPositions(userID string) ([]database.LeveragedPosition, error)
	GetAllOpenPositions() ([]database.LeveragedPosition, error)
}

// PriceSource supplies live market prices. *market.BybitClient satisfies it.
type PriceSource interface {
	GetTicker(symbol string) *market.Ticker
}

// Compile-time assertions that the production types still satisfy the
// interfaces. If a signature drifts, this fails at build time rather than in
// production.
var (
	_ Store       = (*database.DB)(nil)
	_ PriceSource = (*market.BybitClient)(nil)
)