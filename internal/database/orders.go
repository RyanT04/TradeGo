package database

import (
	"context"
	"time"

	"github.com/RyanT04/TradeGo/internal/models"
)

func (db *DB) CreateOrder(userID, symbol, side, orderType string, quantity, price float64) (*models.Order, error) {
	order := &models.Order{}
	err := db.Pool.QueryRow(
		context.Background(),
		`INSERT INTO orders (user_id, symbol, side, type, quantity, price)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, user_id, symbol, side, type, quantity, price, status, created_at`,
		userID, symbol, side, orderType, quantity, price,
	).Scan(&order.ID, &order.UserID, &order.Symbol, &order.Side, &order.Type,
		&order.Quantity, &order.Price, &order.Status, &order.CreatedAt)

	return order, err
}

func (db *DB) FillOrder(orderID string) error {
	now := time.Now()
	_, err := db.Pool.Exec(
		context.Background(),
		`UPDATE orders SET status = 'FILLED', filled_at = $1 WHERE id = $2`,
		now, orderID,
	)
	return err
}

func (db *DB) GetOpenOrders(userID string) ([]models.Order, error) {
	rows, err := db.Pool.Query(
		context.Background(),
		`SELECT id, user_id, symbol, side, type, quantity, price, status, created_at
		 FROM orders WHERE user_id = $1 AND status = 'OPEN'
		 ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var orders []models.Order
	for rows.Next() {
		var o models.Order
		if err := rows.Scan(&o.ID, &o.UserID, &o.Symbol, &o.Side, &o.Type,
			&o.Quantity, &o.Price, &o.Status, &o.CreatedAt); err != nil {
			return nil, err
		}
		orders = append(orders, o)
	}
	return orders, nil
}

func (db *DB) RecordTrade(userID, symbol, side string, quantity, price, total float64) (*models.Trade, error) {
	trade := &models.Trade{}
	err := db.Pool.QueryRow(
		context.Background(),
		`INSERT INTO trades (user_id, symbol, side, quantity, price, total)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, user_id, symbol, side, quantity, price, total, created_at`,
		userID, symbol, side, quantity, price, total,
	).Scan(&trade.ID, &trade.UserID, &trade.Symbol, &trade.Side,
		&trade.Quantity, &trade.Price, &trade.Total, &trade.CreatedAt)

	return trade, err
}

func (db *DB) UpdateBalance(userID string, amount float64) error {
	_, err := db.Pool.Exec(
		context.Background(),
		`UPDATE users SET balance = balance + $1 WHERE id = $2`,
		amount, userID,
	)
	return err
}

func (db *DB) UpsertHolding(userID, symbol string, quantity, price float64) error {
	_, err := db.Pool.Exec(
		context.Background(),
		`INSERT INTO holdings (user_id, symbol, quantity, avg_buy_price)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (user_id, symbol) DO UPDATE SET
		   avg_buy_price = CASE
		     WHEN holdings.quantity + $3 > 0 THEN
		       (holdings.quantity * holdings.avg_buy_price + $3 * $4) / (holdings.quantity + $3)
		     ELSE 0
		   END,
		   quantity = holdings.quantity + $3,
		   updated_at = NOW()`,
		userID, symbol, quantity, price,
	)
	return err
}

func (db *DB) GetHolding(userID, symbol string) (*models.Holding, error) {
	h := &models.Holding{}
	err := db.Pool.QueryRow(
		context.Background(),
		`SELECT id, user_id, symbol, quantity, avg_buy_price, updated_at
		 FROM holdings WHERE user_id = $1 AND symbol = $2`,
		userID, symbol,
	).Scan(&h.ID, &h.UserID, &h.Symbol, &h.Quantity, &h.AvgBuyPrice, &h.UpdatedAt)

	return h, err
}

func (db *DB) GetHoldings(userID string) ([]models.Holding, error) {
	rows, err := db.Pool.Query(
		context.Background(),
		`SELECT id, user_id, symbol, quantity, avg_buy_price, updated_at
		 FROM holdings WHERE user_id = $1 AND quantity > 0
		 ORDER BY updated_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var holdings []models.Holding
	for rows.Next() {
		var h models.Holding
		if err := rows.Scan(&h.ID, &h.UserID, &h.Symbol, &h.Quantity, &h.AvgBuyPrice, &h.UpdatedAt); err != nil {
			return nil, err
		}
		holdings = append(holdings, h)
	}
	return holdings, nil
}

func (db *DB) GetTrades(userID string, limit int) ([]models.Trade, error) {
	rows, err := db.Pool.Query(
		context.Background(),
		`SELECT id, user_id, symbol, side, quantity, price, total, created_at
		 FROM trades WHERE user_id = $1
		 ORDER BY created_at DESC
		 LIMIT $2`,
		userID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	trades := []models.Trade{}
	for rows.Next() {
		var t models.Trade
		if err := rows.Scan(&t.ID, &t.UserID, &t.Symbol, &t.Side,
			&t.Quantity, &t.Price, &t.Total, &t.CreatedAt); err != nil {
			return nil, err
		}
		trades = append(trades, t)
	}
	return trades, nil
}
