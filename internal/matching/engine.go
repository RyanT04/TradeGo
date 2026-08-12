package matching

import (
	"fmt"
	"log"
	"math"
	"strconv"
	"time"

	"github.com/RyanT04/TradeGo/internal/models"
)

type Engine struct {
	db    Store
	bybit PriceSource
}

// NewEngine takes interfaces, so production code can pass *database.DB and
// *market.BybitClient unchanged while tests pass fakes.
func NewEngine(db Store, bybit PriceSource) *Engine {
	return &Engine{db: db, bybit: bybit}
}

type TradeResult struct {
	Trade   *models.Trade `json:"trade"`
	Latency time.Duration `json:"latency"`
}

// validateQuantity rejects quantities that would corrupt balances.
//
// A negative quantity is the dangerous case: total = price * quantity would be
// negative, and a naive "subtract the total" would credit the account instead
// of debiting it.
func validateQuantity(quantity float64) error {
	if math.IsNaN(quantity) || math.IsInf(quantity, 0) {
		return fmt.Errorf("quantity must be a finite number")
	}
	if quantity <= 0 {
		return fmt.Errorf("quantity must be positive, got %v", quantity)
	}
	return nil
}

func (e *Engine) priceFor(symbol string) (float64, error) {
	ticker := e.bybit.GetTicker(symbol)
	if ticker == nil {
		return 0, fmt.Errorf("no price data for %s", symbol)
	}
	price, err := strconv.ParseFloat(ticker.Price, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid price: %w", err)
	}
	if math.IsNaN(price) || math.IsInf(price, 0) || price <= 0 {
		return 0, fmt.Errorf("invalid price for %s: %v", symbol, price)
	}
	return price, nil
}

// shortID trims a user ID for logging without panicking on short IDs.
func shortID(id string) string {
	if len(id) > 8 {
		return id[:8]
	}
	return id
}

func (e *Engine) ExecuteMarketBuy(userID, symbol string, quantity float64) (*TradeResult, error) {
	start := time.Now()

	if err := validateQuantity(quantity); err != nil {
		return nil, err
	}

	price, err := e.priceFor(symbol)
	if err != nil {
		return nil, err
	}

	// Balance check, debit, holding update, and trade record all happen inside
	// a single transaction with the user row locked. See database.ExecuteBuy.
	trade, err := e.db.ExecuteBuy(userID, symbol, quantity, price)
	if err != nil {
		return nil, err
	}

	latency := time.Since(start)
	log.Printf("BUY executed: %s %.6f %s @ %.2f ($%.2f) in %v",
		shortID(userID), quantity, symbol, price, price*quantity, latency)

	return &TradeResult{Trade: trade, Latency: latency}, nil
}

func (e *Engine) ExecuteMarketSell(userID, symbol string, quantity float64) (*TradeResult, error) {
	start := time.Now()

	if err := validateQuantity(quantity); err != nil {
		return nil, err
	}

	price, err := e.priceFor(symbol)
	if err != nil {
		return nil, err
	}

	trade, err := e.db.ExecuteSell(userID, symbol, quantity, price)
	if err != nil {
		return nil, err
	}

	latency := time.Since(start)
	log.Printf("SELL executed: %s %.6f %s @ %.2f ($%.2f) in %v",
		shortID(userID), quantity, symbol, price, price*quantity, latency)

	return &TradeResult{Trade: trade, Latency: latency}, nil
}