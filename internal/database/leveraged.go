package database

import (
	"context"
	"time"

	"github.com/RyanT04/TradeGo/internal/models"
)

type LeveragedPosition struct {
	ID               string     `json:"id"`
	UserID           string     `json:"user_id"`
	Symbol           string     `json:"symbol"`
	Direction        string     `json:"direction"`
	Leverage         int        `json:"leverage"`
	EntryPrice       float64    `json:"entry_price"`
	SizeUSD          float64    `json:"size_usd"`
	MarginUSD        float64    `json:"margin_usd"`
	LiquidationPrice float64    `json:"liquidation_price"`
	IsOpen           bool       `json:"is_open"`
	ClosePrice       *float64   `json:"close_price,omitempty"`
	PnL              *float64   `json:"pnl,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	ClosedAt         *time.Time `json:"closed_at,omitempty"`
}

func (db *DB) OpenLeveragedPosition(userID, symbol, direction string, leverage int, entryPrice, sizeUSD, marginUSD, liquidationPrice float64) (*LeveragedPosition, error) {
	pos := &LeveragedPosition{}
	err := db.Pool.QueryRow(
		context.Background(),
		`INSERT INTO leveraged_positions 
		 (user_id, symbol, direction, leverage, entry_price, size_usd, margin_usd, liquidation_price)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		 RETURNING id, user_id, symbol, direction, leverage, entry_price, size_usd, margin_usd, 
		           liquidation_price, is_open, close_price, pnl, created_at, closed_at`,
		userID, symbol, direction, leverage, entryPrice, sizeUSD, marginUSD, liquidationPrice,
	).Scan(&pos.ID, &pos.UserID, &pos.Symbol, &pos.Direction, &pos.Leverage,
		&pos.EntryPrice, &pos.SizeUSD, &pos.MarginUSD, &pos.LiquidationPrice,
		&pos.IsOpen, &pos.ClosePrice, &pos.PnL, &pos.CreatedAt, &pos.ClosedAt)
	return pos, err
}

func (db *DB) ClosePosition(positionID string, closePrice, pnl float64) error {
	now := time.Now()
	_, err := db.Pool.Exec(
		context.Background(),
		`UPDATE leveraged_positions 
		 SET is_open = FALSE, close_price = $1, pnl = $2, closed_at = $3
		 WHERE id = $4 AND is_open = TRUE`,
		closePrice, pnl, now, positionID,
	)
	return err
}

func (db *DB) GetOpenPositions(userID string) ([]LeveragedPosition, error) {
	rows, err := db.Pool.Query(
		context.Background(),
		`SELECT id, user_id, symbol, direction, leverage, entry_price, size_usd, margin_usd,
		        liquidation_price, is_open, close_price, pnl, created_at, closed_at
		 FROM leveraged_positions WHERE user_id = $1 AND is_open = TRUE
		 ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	positions := []LeveragedPosition{}
	for rows.Next() {
		var p LeveragedPosition
		if err := rows.Scan(&p.ID, &p.UserID, &p.Symbol, &p.Direction, &p.Leverage,
			&p.EntryPrice, &p.SizeUSD, &p.MarginUSD, &p.LiquidationPrice,
			&p.IsOpen, &p.ClosePrice, &p.PnL, &p.CreatedAt, &p.ClosedAt); err != nil {
			return nil, err
		}
		positions = append(positions, p)
	}
	return positions, nil
}

func (db *DB) GetClosedPositions(userID string, limit int) ([]LeveragedPosition, error) {
	rows, err := db.Pool.Query(
		context.Background(),
		`SELECT id, user_id, symbol, direction, leverage, entry_price, size_usd, margin_usd,
		        liquidation_price, is_open, close_price, pnl, created_at, closed_at
		 FROM leveraged_positions WHERE user_id = $1 AND is_open = FALSE
		 ORDER BY closed_at DESC LIMIT $2`,
		userID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	positions := []LeveragedPosition{}
	for rows.Next() {
		var p LeveragedPosition
		if err := rows.Scan(&p.ID, &p.UserID, &p.Symbol, &p.Direction, &p.Leverage,
			&p.EntryPrice, &p.SizeUSD, &p.MarginUSD, &p.LiquidationPrice,
			&p.IsOpen, &p.ClosePrice, &p.PnL, &p.CreatedAt, &p.ClosedAt); err != nil {
			return nil, err
		}
		positions = append(positions, p)
	}
	return positions, nil
}

func (db *DB) GetAllOpenPositions() ([]LeveragedPosition, error) {
	rows, err := db.Pool.Query(
		context.Background(),
		`SELECT id, user_id, symbol, direction, leverage, entry_price, size_usd, margin_usd,
		        liquidation_price, is_open, close_price, pnl, created_at, closed_at
		 FROM leveraged_positions WHERE is_open = TRUE`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	positions := []LeveragedPosition{}
	for rows.Next() {
		var p LeveragedPosition
		if err := rows.Scan(&p.ID, &p.UserID, &p.Symbol, &p.Direction, &p.Leverage,
			&p.EntryPrice, &p.SizeUSD, &p.MarginUSD, &p.LiquidationPrice,
			&p.IsOpen, &p.ClosePrice, &p.PnL, &p.CreatedAt, &p.ClosedAt); err != nil {
			return nil, err
		}
		positions = append(positions, p)
	}
	return positions, nil
}

var _ = models.Trade{} // keep models import used
