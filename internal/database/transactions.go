package database

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/RyanT04/TradeGo/internal/models"
)

// Sentinel errors so callers (and tests) can assert on failure modes
// without string matching.
var (
	ErrInsufficientBalance  = errors.New("insufficient balance")
	ErrInsufficientHoldings = errors.New("insufficient holdings")
	ErrPositionNotFound     = errors.New("position not found or already closed")
)

// upsertHoldingSQL is the same statement used by UpsertHolding, reused inside
// transactions so buy/sell share one definition of average-price maintenance.
const upsertHoldingSQL = `
	INSERT INTO holdings (user_id, symbol, quantity, avg_buy_price)
	VALUES ($1, $2, $3, $4)
	ON CONFLICT (user_id, symbol) DO UPDATE SET
	  avg_buy_price = CASE
	    WHEN holdings.quantity + $3 > 0 THEN
	      (holdings.quantity * holdings.avg_buy_price + $3 * $4) / (holdings.quantity + $3)
	    ELSE 0
	  END,
	  quantity = holdings.quantity + $3,
	  updated_at = NOW()`

const insertTradeSQL = `
	INSERT INTO trades (user_id, symbol, side, quantity, price, total)
	VALUES ($1, $2, $3, $4, $5, $6)
	RETURNING id, user_id, symbol, side, quantity, price, total, created_at`

// ExecuteBuy performs the whole buy in one transaction. The user row is locked
// with SELECT ... FOR UPDATE before the balance check, so two concurrent buys
// cannot both observe a sufficient balance and both deduct from it.
func (db *DB) ExecuteBuy(userID, symbol string, quantity, price float64) (*models.Trade, error) {
	ctx := context.Background()
	total := price * quantity

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck // no-op once committed

	var balance float64
	if err := tx.QueryRow(ctx,
		`SELECT balance FROM users WHERE id = $1 FOR UPDATE`,
		userID,
	).Scan(&balance); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("user not found")
		}
		return nil, fmt.Errorf("locking user: %w", err)
	}

	if balance < total {
		return nil, fmt.Errorf("%w: have %.2f, need %.2f", ErrInsufficientBalance, balance, total)
	}

	if _, err := tx.Exec(ctx,
		`UPDATE users SET balance = balance - $1 WHERE id = $2`,
		total, userID,
	); err != nil {
		return nil, fmt.Errorf("debiting balance: %w", err)
	}

	if _, err := tx.Exec(ctx, upsertHoldingSQL, userID, symbol, quantity, price); err != nil {
		return nil, fmt.Errorf("updating holding: %w", err)
	}

	trade := &models.Trade{}
	if err := tx.QueryRow(ctx, insertTradeSQL,
		userID, symbol, "BUY", quantity, price, total,
	).Scan(&trade.ID, &trade.UserID, &trade.Symbol, &trade.Side,
		&trade.Quantity, &trade.Price, &trade.Total, &trade.CreatedAt); err != nil {
		return nil, fmt.Errorf("recording trade: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}
	return trade, nil
}

// ExecuteSell mirrors ExecuteBuy. The holdings row is locked before the
// quantity check so a user cannot sell the same coins twice concurrently.
func (db *DB) ExecuteSell(userID, symbol string, quantity, price float64) (*models.Trade, error) {
	ctx := context.Background()
	total := price * quantity

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var held float64
	if err := tx.QueryRow(ctx,
		`SELECT quantity FROM holdings WHERE user_id = $1 AND symbol = $2 FOR UPDATE`,
		userID, symbol,
	).Scan(&held); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: no position in %s", ErrInsufficientHoldings, symbol)
		}
		return nil, fmt.Errorf("locking holding: %w", err)
	}

	if held < quantity {
		return nil, fmt.Errorf("%w: have %.8f, need %.8f", ErrInsufficientHoldings, held, quantity)
	}

	if _, err := tx.Exec(ctx, upsertHoldingSQL, userID, symbol, -quantity, price); err != nil {
		return nil, fmt.Errorf("updating holding: %w", err)
	}

	if _, err := tx.Exec(ctx,
		`UPDATE users SET balance = balance + $1 WHERE id = $2`,
		total, userID,
	); err != nil {
		return nil, fmt.Errorf("crediting balance: %w", err)
	}

	trade := &models.Trade{}
	if err := tx.QueryRow(ctx, insertTradeSQL,
		userID, symbol, "SELL", quantity, price, total,
	).Scan(&trade.ID, &trade.UserID, &trade.Symbol, &trade.Side,
		&trade.Quantity, &trade.Price, &trade.Total, &trade.CreatedAt); err != nil {
		return nil, fmt.Errorf("recording trade: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}
	return trade, nil
}

// OpenLeveragedPositionTx locks the user row, verifies the margin is covered,
// debits it, and inserts the position — all or nothing.
func (db *DB) OpenLeveragedPositionTx(
	userID, symbol, direction string,
	leverage int,
	entryPrice, sizeUSD, marginUSD, liquidationPrice float64,
) (*LeveragedPosition, error) {
	ctx := context.Background()

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var balance float64
	if err := tx.QueryRow(ctx,
		`SELECT balance FROM users WHERE id = $1 FOR UPDATE`,
		userID,
	).Scan(&balance); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("user not found")
		}
		return nil, fmt.Errorf("locking user: %w", err)
	}

	if balance < marginUSD {
		return nil, fmt.Errorf("%w: have %.2f, need %.2f", ErrInsufficientBalance, balance, marginUSD)
	}

	if _, err := tx.Exec(ctx,
		`UPDATE users SET balance = balance - $1 WHERE id = $2`,
		marginUSD, userID,
	); err != nil {
		return nil, fmt.Errorf("debiting margin: %w", err)
	}

	pos := &LeveragedPosition{}
	if err := tx.QueryRow(ctx,
		`INSERT INTO leveraged_positions
		 (user_id, symbol, direction, leverage, entry_price, size_usd, margin_usd, liquidation_price)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		 RETURNING id, user_id, symbol, direction, leverage, entry_price, size_usd, margin_usd,
		           liquidation_price, is_open, close_price, pnl, created_at, closed_at`,
		userID, symbol, direction, leverage, entryPrice, sizeUSD, marginUSD, liquidationPrice,
	).Scan(&pos.ID, &pos.UserID, &pos.Symbol, &pos.Direction, &pos.Leverage,
		&pos.EntryPrice, &pos.SizeUSD, &pos.MarginUSD, &pos.LiquidationPrice,
		&pos.IsOpen, &pos.ClosePrice, &pos.PnL, &pos.CreatedAt, &pos.ClosedAt); err != nil {
		return nil, fmt.Errorf("inserting position: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}
	return pos, nil
}

// CloseLeveragedPositionTx locks the position row and refuses to proceed if it
// is already closed. This is what stops a user-initiated close from racing the
// liquidation worker and refunding margin on a position that was liquidated.
//
// The refund is computed from the locked row's own margin_usd rather than from
// a caller-supplied figure, so the credit can't be inflated by a stale read.
func (db *DB) CloseLeveragedPositionTx(userID, positionID string, closePrice, pnl float64) (*LeveragedPosition, error) {
	ctx := context.Background()

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var marginUSD float64
	if err := tx.QueryRow(ctx,
		`SELECT margin_usd FROM leveraged_positions
		 WHERE id = $1 AND user_id = $2 AND is_open = TRUE
		 FOR UPDATE`,
		positionID, userID,
	).Scan(&marginUSD); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrPositionNotFound
		}
		return nil, fmt.Errorf("locking position: %w", err)
	}

	pos := &LeveragedPosition{}
	if err := tx.QueryRow(ctx,
		`UPDATE leveraged_positions
		 SET is_open = FALSE, close_price = $1, pnl = $2, closed_at = NOW()
		 WHERE id = $3
		 RETURNING id, user_id, symbol, direction, leverage, entry_price, size_usd, margin_usd,
		           liquidation_price, is_open, close_price, pnl, created_at, closed_at`,
		closePrice, pnl, positionID,
	).Scan(&pos.ID, &pos.UserID, &pos.Symbol, &pos.Direction, &pos.Leverage,
		&pos.EntryPrice, &pos.SizeUSD, &pos.MarginUSD, &pos.LiquidationPrice,
		&pos.IsOpen, &pos.ClosePrice, &pos.PnL, &pos.CreatedAt, &pos.ClosedAt); err != nil {
		return nil, fmt.Errorf("closing position: %w", err)
	}

	// Margin returns, adjusted by realised PnL. Never credit below zero.
	refund := marginUSD + pnl
	if refund < 0 {
		refund = 0
	}
	if _, err := tx.Exec(ctx,
		`UPDATE users SET balance = balance + $1 WHERE id = $2`,
		refund, userID,
	); err != nil {
		return nil, fmt.Errorf("crediting balance: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}
	return pos, nil
}

// LiquidatePosition closes a position at a total loss of margin. It returns
// ErrPositionNotFound if the position was already closed, so the worker can
// skip it quietly rather than double-processing.
func (db *DB) LiquidatePosition(positionID string, closePrice float64) error {
	ctx := context.Background()

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var marginUSD float64
	if err := tx.QueryRow(ctx,
		`SELECT margin_usd FROM leveraged_positions
		 WHERE id = $1 AND is_open = TRUE
		 FOR UPDATE`,
		positionID,
	).Scan(&marginUSD); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrPositionNotFound
		}
		return fmt.Errorf("locking position: %w", err)
	}

	// Liquidation forfeits the entire margin; it was already debited at open,
	// so nothing is credited back here.
	if _, err := tx.Exec(ctx,
		`UPDATE leveraged_positions
		 SET is_open = FALSE, close_price = $1, pnl = $2, closed_at = NOW()
		 WHERE id = $3`,
		closePrice, -marginUSD, positionID,
	); err != nil {
		return fmt.Errorf("liquidating position: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	return nil
}
