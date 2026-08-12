package matching

import (
	"errors"
	"math"
	"sync"
	"testing"

	"github.com/RyanT04/TradeGo/internal/database"
)

const testUser = "user-0000-1111-2222"

// newTestEngine returns an engine wired to fakes, with BTCUSDT priced at
// $1,000 and the user holding $10,000, unless the test changes it.
func newTestEngine(t *testing.T) (*Engine, *fakeStore, *fakePrices) {
	t.Helper()

	store := newFakeStore()
	prices := newFakePrices()

	store.setBalance(testUser, 10_000)
	prices.set("BTCUSDT", "1000")

	return NewEngine(store, prices), store, prices
}

// --- Input validation -------------------------------------------------------

func TestExecuteMarketBuy_RejectsInvalidQuantity(t *testing.T) {
	tests := []struct {
		name     string
		quantity float64
	}{
		{"zero", 0},
		{"negative", -1},
		{"negative fractional", -0.5},
		{"NaN", math.NaN()},
		{"positive infinity", math.Inf(1)},
		{"negative infinity", math.Inf(-1)},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			engine, store, _ := newTestEngine(t)
			before := store.balanceOf(testUser)

			_, err := engine.ExecuteMarketBuy(testUser, "BTCUSDT", tc.quantity)
			if err == nil {
				t.Fatalf("expected error for quantity %v, got nil", tc.quantity)
			}

			// The critical assertion: a rejected order must not move money.
			// A negative quantity previously credited the account.
			if after := store.balanceOf(testUser); after != before {
				t.Errorf("balance changed on rejected order: before %.2f, after %.2f", before, after)
			}
		})
	}
}

func TestExecuteMarketSell_RejectsInvalidQuantity(t *testing.T) {
	for _, quantity := range []float64{0, -1, math.NaN(), math.Inf(1)} {
		engine, store, _ := newTestEngine(t)
		store.setHolding(testUser, "BTCUSDT", 5)
		before := store.balanceOf(testUser)

		if _, err := engine.ExecuteMarketSell(testUser, "BTCUSDT", quantity); err == nil {
			t.Errorf("expected error for quantity %v, got nil", quantity)
		}
		if after := store.balanceOf(testUser); after != before {
			t.Errorf("balance changed on rejected sell (quantity %v): before %.2f, after %.2f",
				quantity, before, after)
		}
		if h := store.holdingOf(testUser, "BTCUSDT"); h != 5 {
			t.Errorf("holdings changed on rejected sell (quantity %v): got %.8f, want 5", quantity, h)
		}
	}
}

func TestExecuteMarketBuy_RejectsUnknownSymbol(t *testing.T) {
	engine, store, _ := newTestEngine(t)
	before := store.balanceOf(testUser)

	if _, err := engine.ExecuteMarketBuy(testUser, "NOSUCHCOIN", 1); err == nil {
		t.Fatal("expected error for unknown symbol, got nil")
	}
	if after := store.balanceOf(testUser); after != before {
		t.Errorf("balance changed for unknown symbol: before %.2f, after %.2f", before, after)
	}
}

func TestExecuteMarketBuy_RejectsUnparseablePrice(t *testing.T) {
	engine, _, prices := newTestEngine(t)
	prices.set("BADCOIN", "not-a-number")

	if _, err := engine.ExecuteMarketBuy(testUser, "BADCOIN", 1); err == nil {
		t.Fatal("expected error for unparseable price, got nil")
	}
}

// --- Balance and holdings invariants ----------------------------------------

func TestExecuteMarketBuy_DebitsExactly(t *testing.T) {
	engine, store, _ := newTestEngine(t)

	if _, err := engine.ExecuteMarketBuy(testUser, "BTCUSDT", 2); err != nil {
		t.Fatalf("buy failed: %v", err)
	}

	// 2 units at $1,000 from $10,000.
	if got, want := store.balanceOf(testUser), 8_000.0; got != want {
		t.Errorf("balance = %.2f, want %.2f", got, want)
	}
	if got, want := store.holdingOf(testUser, "BTCUSDT"), 2.0; got != want {
		t.Errorf("holding = %.8f, want %.8f", got, want)
	}
}

func TestExecuteMarketBuy_RejectsWhenBalanceInsufficient(t *testing.T) {
	engine, store, _ := newTestEngine(t)
	store.setBalance(testUser, 500)

	_, err := engine.ExecuteMarketBuy(testUser, "BTCUSDT", 1) // needs $1,000
	if err == nil {
		t.Fatal("expected insufficient balance error, got nil")
	}
	if !errors.Is(err, database.ErrInsufficientBalance) {
		t.Errorf("error = %v, want ErrInsufficientBalance", err)
	}
	if got := store.balanceOf(testUser); got != 500 {
		t.Errorf("balance = %.2f, want 500 (unchanged)", got)
	}
	if got := store.holdingOf(testUser, "BTCUSDT"); got != 0 {
		t.Errorf("holding = %.8f, want 0 — coins credited without payment", got)
	}
}

func TestExecuteMarketSell_RejectsWhenHoldingsInsufficient(t *testing.T) {
	engine, store, _ := newTestEngine(t)
	store.setHolding(testUser, "BTCUSDT", 0.5)
	before := store.balanceOf(testUser)

	_, err := engine.ExecuteMarketSell(testUser, "BTCUSDT", 1)
	if err == nil {
		t.Fatal("expected insufficient holdings error, got nil")
	}
	if !errors.Is(err, database.ErrInsufficientHoldings) {
		t.Errorf("error = %v, want ErrInsufficientHoldings", err)
	}
	if after := store.balanceOf(testUser); after != before {
		t.Errorf("balance credited on failed sell: before %.2f, after %.2f", before, after)
	}
}

func TestBuyThenSell_RoundTripsBalance(t *testing.T) {
	engine, store, _ := newTestEngine(t)

	if _, err := engine.ExecuteMarketBuy(testUser, "BTCUSDT", 3); err != nil {
		t.Fatalf("buy failed: %v", err)
	}
	if _, err := engine.ExecuteMarketSell(testUser, "BTCUSDT", 3); err != nil {
		t.Fatalf("sell failed: %v", err)
	}

	// Same price both ways and no fees, so the balance should return exactly.
	if got, want := store.balanceOf(testUser), 10_000.0; got != want {
		t.Errorf("balance after round trip = %.2f, want %.2f", got, want)
	}
	if got := store.holdingOf(testUser, "BTCUSDT"); got != 0 {
		t.Errorf("holding after round trip = %.8f, want 0", got)
	}
}

func TestExecuteMarketBuy_StoreFailureLeavesBalanceIntact(t *testing.T) {
	engine, store, _ := newTestEngine(t)
	store.failOn = "ExecuteBuy"
	before := store.balanceOf(testUser)

	if _, err := engine.ExecuteMarketBuy(testUser, "BTCUSDT", 1); err == nil {
		t.Fatal("expected error from failing store, got nil")
	}
	if after := store.balanceOf(testUser); after != before {
		t.Errorf("balance changed despite store failure: before %.2f, after %.2f", before, after)
	}
	if got := store.holdingOf(testUser, "BTCUSDT"); got != 0 {
		t.Errorf("holding = %.8f, want 0 — half-applied trade", got)
	}
}

// --- Concurrency ------------------------------------------------------------

// TestConcurrentBuys_NoOverdraft is the regression test for the TOCTOU race.
//
// The old engine read the balance, checked it, then debited in a separate step.
// Fifty goroutines each buying $1,000 against a $10,000 balance could all pass
// the check before any debit landed, driving the balance negative.
//
// Run with -race.
func TestConcurrentBuys_NoOverdraft(t *testing.T) {
	engine, store, _ := newTestEngine(t)

	const (
		goroutines  = 50
		quantity    = 1.0    // $1,000 per order at the fixed test price
		startingBal = 10_000 // affords exactly 10 orders
	)
	store.setBalance(testUser, startingBal)

	var (
		wg        sync.WaitGroup
		mu        sync.Mutex
		succeeded int
	)

	start := make(chan struct{})
	for i := 0; i < goroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start // release all goroutines together to maximise contention
			if _, err := engine.ExecuteMarketBuy(testUser, "BTCUSDT", quantity); err == nil {
				mu.Lock()
				succeeded++
				mu.Unlock()
			}
		}()
	}
	close(start)
	wg.Wait()

	finalBalance := store.balanceOf(testUser)

	// The invariant that matters: a balance can never go negative.
	if finalBalance < 0 {
		t.Fatalf("OVERDRAFT: balance went negative (%.2f) after %d concurrent buys",
			finalBalance, goroutines)
	}

	// Exactly ten orders are affordable, and every successful order must have
	// been paid for.
	if succeeded != 10 {
		t.Errorf("succeeded = %d, want 10 affordable orders", succeeded)
	}

	wantBalance := float64(startingBal) - float64(succeeded)*1000
	if finalBalance != wantBalance {
		t.Errorf("balance = %.2f, want %.2f (%d fills x $1000)",
			finalBalance, wantBalance, succeeded)
	}

	// Coins credited must match orders paid for.
	if got, want := store.holdingOf(testUser, "BTCUSDT"), float64(succeeded); got != want {
		t.Errorf("holding = %.8f, want %.8f — coins and payments disagree", got, want)
	}
}

// TestConcurrentSells_NoPhantomCoins checks the mirror case: a user cannot sell
// the same holdings twice by racing two sells.
func TestConcurrentSells_NoPhantomCoins(t *testing.T) {
	engine, store, _ := newTestEngine(t)
	store.setBalance(testUser, 0)
	store.setHolding(testUser, "BTCUSDT", 5)

	var (
		wg        sync.WaitGroup
		mu        sync.Mutex
		succeeded int
	)

	start := make(chan struct{})
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			if _, err := engine.ExecuteMarketSell(testUser, "BTCUSDT", 1); err == nil {
				mu.Lock()
				succeeded++
				mu.Unlock()
			}
		}()
	}
	close(start)
	wg.Wait()

	if got := store.holdingOf(testUser, "BTCUSDT"); got < 0 {
		t.Fatalf("holdings went negative (%.8f) — sold coins the user didn't have", got)
	}
	if succeeded != 5 {
		t.Errorf("succeeded = %d, want 5", succeeded)
	}
	if got, want := store.balanceOf(testUser), float64(succeeded)*1000; got != want {
		t.Errorf("balance = %.2f, want %.2f", got, want)
	}
}

// --- Leveraged positions ----------------------------------------------------

func TestOpenLeveragedPosition_Validation(t *testing.T) {
	tests := []struct {
		name      string
		direction string
		leverage  int
		margin    float64
	}{
		{"bad direction", "SIDEWAYS", 10, 100},
		{"lowercase direction", "long", 10, 100},
		{"leverage too low", "LONG", 1, 100},
		{"leverage too high", "LONG", 51, 100},
		{"zero margin", "LONG", 10, 0},
		{"negative margin", "LONG", 10, -100},
		{"NaN margin", "LONG", 10, math.NaN()},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			engine, store, _ := newTestEngine(t)
			before := store.balanceOf(testUser)

			_, err := engine.OpenLeveragedPosition(testUser, "BTCUSDT", tc.direction, tc.leverage, tc.margin)
			if err == nil {
				t.Fatal("expected validation error, got nil")
			}
			if after := store.balanceOf(testUser); after != before {
				t.Errorf("balance changed on rejected position: before %.2f, after %.2f", before, after)
			}
		})
	}
}

func TestOpenLeveragedPosition_DebitsMarginAndSetsLiquidation(t *testing.T) {
	engine, store, _ := newTestEngine(t)

	res, err := engine.OpenLeveragedPosition(testUser, "BTCUSDT", "LONG", 10, 500)
	if err != nil {
		t.Fatalf("open failed: %v", err)
	}

	if got, want := store.balanceOf(testUser), 9_500.0; got != want {
		t.Errorf("balance = %.2f, want %.2f", got, want)
	}
	if got, want := res.Position.SizeUSD, 5_000.0; got != want {
		t.Errorf("size = %.2f, want %.2f (margin x leverage)", got, want)
	}
	// LONG at 10x: liquidation = 1000 * (1 - 1/10) = 900
	if got, want := res.Position.LiquidationPrice, 900.0; got != want {
		t.Errorf("liquidation price = %.2f, want %.2f", got, want)
	}
}

func TestCalculateLiquidationPrice(t *testing.T) {
	tests := []struct {
		direction string
		entry     float64
		leverage  int
		want      float64
	}{
		{"LONG", 1000, 2, 500},
		{"LONG", 1000, 10, 900},
		{"LONG", 1000, 50, 980},
		{"SHORT", 1000, 2, 1500},
		{"SHORT", 1000, 10, 1100},
		{"SHORT", 1000, 50, 1020},
	}

	for _, tc := range tests {
		got := calculateLiquidationPrice(tc.direction, tc.entry, tc.leverage)
		if math.Abs(got-tc.want) > 1e-9 {
			t.Errorf("calculateLiquidationPrice(%s, %.0f, %d) = %.4f, want %.4f",
				tc.direction, tc.entry, tc.leverage, got, tc.want)
		}
	}
}

func TestCalculatePnL(t *testing.T) {
	tests := []struct {
		name      string
		direction string
		entry     float64
		current   float64
		size      float64
		want      float64
	}{
		{"long in profit", "LONG", 1000, 1100, 5000, 500},
		{"long at a loss", "LONG", 1000, 900, 5000, -500},
		{"long flat", "LONG", 1000, 1000, 5000, 0},
		{"short in profit", "SHORT", 1000, 900, 5000, 500},
		{"short at a loss", "SHORT", 1000, 1100, 5000, -500},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := calculatePnL(tc.direction, tc.entry, tc.current, tc.size)
			if math.Abs(got-tc.want) > 1e-9 {
				t.Errorf("got %.4f, want %.4f", got, tc.want)
			}
		})
	}
}

func TestShouldLiquidate(t *testing.T) {
	tests := []struct {
		name      string
		direction string
		price     float64
		liqPrice  float64
		want      bool
	}{
		{"long above liquidation", "LONG", 950, 900, false},
		{"long exactly at liquidation", "LONG", 900, 900, true},
		{"long below liquidation", "LONG", 850, 900, true},
		{"short below liquidation", "SHORT", 1050, 1100, false},
		{"short exactly at liquidation", "SHORT", 1100, 1100, true},
		{"short above liquidation", "SHORT", 1150, 1100, true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := shouldLiquidate(tc.direction, tc.price, tc.liqPrice); got != tc.want {
				t.Errorf("got %v, want %v", got, tc.want)
			}
		})
	}
}

// TestCloseAfterLiquidation_NoDoubleRefund covers the race between a user
// closing a position and the liquidation worker closing the same one.
//
// Previously the close path credited margin + pnl without checking whether the
// position was still open, so a liquidated user could also be refunded.
func TestCloseAfterLiquidation_NoDoubleRefund(t *testing.T) {
	engine, store, prices := newTestEngine(t)

	res, err := engine.OpenLeveragedPosition(testUser, "BTCUSDT", "LONG", 10, 500)
	if err != nil {
		t.Fatalf("open failed: %v", err)
	}
	balanceAfterOpen := store.balanceOf(testUser)

	// The worker liquidates first.
	prices.set("BTCUSDT", "850") // below the 900 liquidation price
	engine.checkLiquidations()

	// The user's close then arrives for an already-liquidated position.
	_, err = engine.CloseLeveragedPosition(testUser, res.Position.ID)
	if err == nil {
		t.Fatal("expected close of liquidated position to fail, got nil")
	}
	if !errors.Is(err, database.ErrPositionNotFound) {
		t.Errorf("error = %v, want ErrPositionNotFound", err)
	}

	// Liquidation forfeits the margin, so no credit should have landed.
	if got := store.balanceOf(testUser); got != balanceAfterOpen {
		t.Errorf("balance = %.2f, want %.2f — margin refunded on a liquidated position",
			got, balanceAfterOpen)
	}
}

func TestCloseLeveragedPosition_RefundsMarginPlusPnL(t *testing.T) {
	engine, store, prices := newTestEngine(t)

	res, err := engine.OpenLeveragedPosition(testUser, "BTCUSDT", "LONG", 10, 500)
	if err != nil {
		t.Fatalf("open failed: %v", err)
	}

	// +10% on a $5,000 position = +$500.
	prices.set("BTCUSDT", "1100")

	closeRes, err := engine.CloseLeveragedPosition(testUser, res.Position.ID)
	if err != nil {
		t.Fatalf("close failed: %v", err)
	}
	if math.Abs(closeRes.PnL-500) > 1e-9 {
		t.Errorf("pnl = %.4f, want 500", closeRes.PnL)
	}

	// $10,000 - $500 margin + ($500 margin + $500 profit) = $10,500.
	if got, want := store.balanceOf(testUser), 10_500.0; math.Abs(got-want) > 1e-9 {
		t.Errorf("balance = %.2f, want %.2f", got, want)
	}
}

func TestCloseLeveragedPosition_UnknownPosition(t *testing.T) {
	engine, _, _ := newTestEngine(t)

	_, err := engine.CloseLeveragedPosition(testUser, "pos-does-not-exist")
	if !errors.Is(err, database.ErrPositionNotFound) {
		t.Errorf("error = %v, want ErrPositionNotFound", err)
	}
}

func TestCloseLeveragedPosition_OtherUsersPosition(t *testing.T) {
	engine, store, _ := newTestEngine(t)
	store.setBalance("other-user", 10_000)

	// Another user opens a position.
	otherEngine := NewEngine(store, newFakePricesWith("BTCUSDT", "1000"))
	res, err := otherEngine.OpenLeveragedPosition("other-user", "BTCUSDT", "LONG", 10, 500)
	if err != nil {
		t.Fatalf("open failed: %v", err)
	}

	// testUser must not be able to close it.
	if _, err := engine.CloseLeveragedPosition(testUser, res.Position.ID); err == nil {
		t.Fatal("expected error closing another user's position, got nil")
	}
	if got, want := store.balanceOf(testUser), 10_000.0; got != want {
		t.Errorf("balance = %.2f, want %.2f — credited from another user's position", got, want)
	}
}

func newFakePricesWith(symbol, price string) *fakePrices {
	p := newFakePrices()
	p.set(symbol, price)
	return p
}