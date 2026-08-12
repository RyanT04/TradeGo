package matching

import (
	"fmt"
	"sync"
	"time"

	"github.com/RyanT04/TradeGo/internal/database"
	"github.com/RyanT04/TradeGo/internal/market"
	"github.com/RyanT04/TradeGo/internal/models"
)

// fakeStore is an in-memory Store implementation for tests.
//
// Its mutex plays the role Postgres row locks play in production: every method
// that reads-then-writes holds the lock for the whole operation. A test that
// passes here proves the *engine* delegates atomically rather than checking and
// writing in separate steps — it does not prove the SQL is correct. That needs
// an integration test against a real Postgres.
type fakeStore struct {
	mu sync.Mutex

	balances  map[string]float64            // userID -> balance
	holdings  map[string]float64            // userID|symbol -> quantity
	positions map[string]*database.LeveragedPosition

	nextID int

	// failOn, when set, makes the named method return an error. Used to test
	// that partial failures don't leave money in an inconsistent state.
	failOn string
}

func newFakeStore() *fakeStore {
	return &fakeStore{
		balances:  make(map[string]float64),
		holdings:  make(map[string]float64),
		positions: make(map[string]*database.LeveragedPosition),
	}
}

func holdingKey(userID, symbol string) string {
	return userID + "|" + symbol
}

func (f *fakeStore) setBalance(userID string, amount float64) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.balances[userID] = amount
}

func (f *fakeStore) balanceOf(userID string) float64 {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.balances[userID]
}

func (f *fakeStore) setHolding(userID, symbol string, quantity float64) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.holdings[holdingKey(userID, symbol)] = quantity
}

func (f *fakeStore) holdingOf(userID, symbol string) float64 {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.holdings[holdingKey(userID, symbol)]
}

func (f *fakeStore) ExecuteBuy(userID, symbol string, quantity, price float64) (*models.Trade, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	if f.failOn == "ExecuteBuy" {
		return nil, fmt.Errorf("simulated store failure")
	}

	total := price * quantity
	if f.balances[userID] < total {
		return nil, fmt.Errorf("%w: have %.2f, need %.2f",
			database.ErrInsufficientBalance, f.balances[userID], total)
	}

	f.balances[userID] -= total
	f.holdings[holdingKey(userID, symbol)] += quantity
	f.nextID++

	return &models.Trade{
		ID:        fmt.Sprintf("trade-%d", f.nextID),
		UserID:    userID,
		Symbol:    symbol,
		Side:      "BUY",
		Quantity:  quantity,
		Price:     price,
		Total:     total,
		CreatedAt: time.Now(),
	}, nil
}

func (f *fakeStore) ExecuteSell(userID, symbol string, quantity, price float64) (*models.Trade, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	if f.failOn == "ExecuteSell" {
		return nil, fmt.Errorf("simulated store failure")
	}

	key := holdingKey(userID, symbol)
	if f.holdings[key] < quantity {
		return nil, fmt.Errorf("%w: have %.8f, need %.8f",
			database.ErrInsufficientHoldings, f.holdings[key], quantity)
	}

	total := price * quantity
	f.holdings[key] -= quantity
	f.balances[userID] += total
	f.nextID++

	return &models.Trade{
		ID:        fmt.Sprintf("trade-%d", f.nextID),
		UserID:    userID,
		Symbol:    symbol,
		Side:      "SELL",
		Quantity:  quantity,
		Price:     price,
		Total:     total,
		CreatedAt: time.Now(),
	}, nil
}

func (f *fakeStore) OpenLeveragedPositionTx(
	userID, symbol, direction string,
	leverage int,
	entryPrice, sizeUSD, marginUSD, liquidationPrice float64,
) (*database.LeveragedPosition, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	if f.balances[userID] < marginUSD {
		return nil, fmt.Errorf("%w: have %.2f, need %.2f",
			database.ErrInsufficientBalance, f.balances[userID], marginUSD)
	}

	f.balances[userID] -= marginUSD
	f.nextID++

	pos := &database.LeveragedPosition{
		ID:               fmt.Sprintf("pos-%d", f.nextID),
		UserID:           userID,
		Symbol:           symbol,
		Direction:        direction,
		Leverage:         leverage,
		EntryPrice:       entryPrice,
		SizeUSD:          sizeUSD,
		MarginUSD:        marginUSD,
		LiquidationPrice: liquidationPrice,
		IsOpen:           true,
		CreatedAt:        time.Now(),
	}
	f.positions[pos.ID] = pos
	return pos, nil
}

func (f *fakeStore) CloseLeveragedPositionTx(userID, positionID string, closePrice, pnl float64) (*database.LeveragedPosition, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	pos, ok := f.positions[positionID]
	if !ok || !pos.IsOpen || pos.UserID != userID {
		return nil, database.ErrPositionNotFound
	}

	pos.IsOpen = false
	pos.ClosePrice = &closePrice
	pos.PnL = &pnl
	now := time.Now()
	pos.ClosedAt = &now

	refund := pos.MarginUSD + pnl
	if refund < 0 {
		refund = 0
	}
	f.balances[userID] += refund

	return pos, nil
}

func (f *fakeStore) LiquidatePosition(positionID string, closePrice float64) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	pos, ok := f.positions[positionID]
	if !ok || !pos.IsOpen {
		return database.ErrPositionNotFound
	}

	pos.IsOpen = false
	pos.ClosePrice = &closePrice
	loss := -pos.MarginUSD
	pos.PnL = &loss
	now := time.Now()
	pos.ClosedAt = &now

	// Margin was debited at open and is forfeited — nothing credited back.
	return nil
}

func (f *fakeStore) GetOpenPositions(userID string) ([]database.LeveragedPosition, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	out := []database.LeveragedPosition{}
	for _, p := range f.positions {
		if p.UserID == userID && p.IsOpen {
			out = append(out, *p)
		}
	}
	return out, nil
}

func (f *fakeStore) GetAllOpenPositions() ([]database.LeveragedPosition, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	out := []database.LeveragedPosition{}
	for _, p := range f.positions {
		if p.IsOpen {
			out = append(out, *p)
		}
	}
	return out, nil
}

// fakePrices is a PriceSource returning fixed prices set by the test.
type fakePrices struct {
	mu     sync.RWMutex
	prices map[string]string
}

func newFakePrices() *fakePrices {
	return &fakePrices{prices: make(map[string]string)}
}

func (p *fakePrices) set(symbol, price string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.prices[symbol] = price
}

func (p *fakePrices) GetTicker(symbol string) *market.Ticker {
	p.mu.RLock()
	defer p.mu.RUnlock()

	price, ok := p.prices[symbol]
	if !ok {
		return nil
	}
	return &market.Ticker{Symbol: symbol, Price: price}
}

// Compile-time checks that the fakes satisfy the same interfaces as production.
var (
	_ Store       = (*fakeStore)(nil)
	_ PriceSource = (*fakePrices)(nil)
)