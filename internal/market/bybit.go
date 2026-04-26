package market

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type Ticker struct {
	Symbol    string    `json:"symbol"`
	Price     string    `json:"lastPrice"`
	Change    string    `json:"price24hPcnt"`
	High      string    `json:"highPrice24h"`
	Low       string    `json:"lowPrice24h"`
	Volume    string    `json:"volume24h"`
	UpdatedAt time.Time `json:"updatedAt"`
	Source    string    `json:"source"` // "ws" or "rest"
}

type BybitClient struct {
	mu      sync.RWMutex
	tickers map[string]*Ticker

	httpClient *http.Client
}

func NewBybitClient() *BybitClient {
	return &BybitClient{
		tickers: make(map[string]*Ticker),
		httpClient: &http.Client{
			Timeout: 4 * time.Second,
		},
	}
}

func (b *BybitClient) GetTicker(symbol string) *Ticker {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.tickers[symbol]
}

func (b *BybitClient) GetAllTickers() map[string]*Ticker {
	b.mu.RLock()
	defer b.mu.RUnlock()
	copy := make(map[string]*Ticker, len(b.tickers))
	for k, v := range b.tickers {
		copy[k] = v
	}
	return copy
}

// Connect starts the WebSocket subscription for the hot symbols
// AND a REST poller for the full set of USDT pairs.
func (b *BybitClient) Connect(symbols []string) {
	go b.run(symbols)
	go b.pollRESTLoop()
}

// ── WebSocket (live, sub-second updates for hot coins) ──

func (b *BybitClient) run(symbols []string) {
	for {
		if err := b.connectAndListen(symbols); err != nil {
			log.Printf("Bybit WebSocket error: %v, reconnecting in 3s...", err)
			time.Sleep(3 * time.Second)
		}
	}
}

func (b *BybitClient) connectAndListen(symbols []string) error {
	conn, _, err := websocket.DefaultDialer.Dial("wss://stream.bybit.com/v5/public/spot", nil)
	if err != nil {
		return err
	}
	defer conn.Close()

	// Bybit spot allows max 10 symbols per subscribe message — batch them
	const batchSize = 10
	for i := 0; i < len(symbols); i += batchSize {
		end := i + batchSize
		if end > len(symbols) {
			end = len(symbols)
		}
		batch := symbols[i:end]

		args := make([]string, len(batch))
		for j, s := range batch {
			args[j] = "tickers." + s
		}

		sub := map[string]any{
			"op":   "subscribe",
			"args": args,
		}
		if err := conn.WriteJSON(sub); err != nil {
			return err
		}
	}

	batches := (len(symbols) + batchSize - 1) / batchSize
	log.Printf("Bybit WebSocket connected, subscribed to %d symbols in %d batches", len(symbols), batches)

	// Keep connection alive
	go func() {
		for {
			time.Sleep(20 * time.Second)
			if err := conn.WriteJSON(map[string]string{"op": "ping"}); err != nil {
				return
			}
		}
	}()

	// Read messages
	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			return err
		}
		b.handleWSMessage(msg)
	}
}

func (b *BybitClient) handleWSMessage(msg []byte) {
	var raw struct {
		Topic string          `json:"topic"`
		Data  json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(msg, &raw); err != nil || raw.Topic == "" {
		return
	}

	var ticker Ticker
	if err := json.Unmarshal(raw.Data, &ticker); err != nil {
		return
	}
	ticker.UpdatedAt = time.Now()
	ticker.Source = "ws"

	b.mu.Lock()
	b.tickers[ticker.Symbol] = &ticker
	b.mu.Unlock()
}

// ── REST poller (every 5s, fills in the long tail of ~400 USDT pairs) ──

type bybitRESTResponse struct {
	RetCode int    `json:"retCode"`
	RetMsg  string `json:"retMsg"`
	Result  struct {
		Category string `json:"category"`
		List     []struct {
			Symbol       string `json:"symbol"`
			LastPrice    string `json:"lastPrice"`
			PriceChange  string `json:"price24hPcnt"`
			HighPrice24h string `json:"highPrice24h"`
			LowPrice24h  string `json:"lowPrice24h"`
			Volume24h    string `json:"volume24h"`
		} `json:"list"`
	} `json:"result"`
}

func (b *BybitClient) pollRESTLoop() {
	// Wait briefly so the WebSocket has a chance to populate first
	time.Sleep(2 * time.Second)

	// Initial fetch immediately, then on a ticker
	b.pollRESTOnce()

	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		b.pollRESTOnce()
	}
}

func (b *BybitClient) pollRESTOnce() {
	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "GET",
		"https://api.bybit.com/v5/market/tickers?category=spot", nil)
	if err != nil {
		log.Printf("bybit REST: failed to build request: %v", err)
		return
	}

	resp, err := b.httpClient.Do(req)
	if err != nil {
		log.Printf("bybit REST: request failed: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("bybit REST: HTTP %d", resp.StatusCode)
		return
	}

	var out bybitRESTResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		log.Printf("bybit REST: decode failed: %v", err)
		return
	}
	if out.RetCode != 0 {
		log.Printf("bybit REST: error %d: %s", out.RetCode, out.RetMsg)
		return
	}

	now := time.Now()
	staleAfter := 4 * time.Second // WebSocket data is fresher than this

	b.mu.Lock()
	defer b.mu.Unlock()

	for _, item := range out.Result.List {
		// Only USDT pairs — skip USDC, BTC-quoted, etc
		if !strings.HasSuffix(item.Symbol, "USDT") {
			continue
		}

		// If WebSocket recently updated this symbol, skip — WS data wins
		if existing, ok := b.tickers[item.Symbol]; ok {
			if existing.Source == "ws" && now.Sub(existing.UpdatedAt) < staleAfter {
				continue
			}
		}

		b.tickers[item.Symbol] = &Ticker{
			Symbol:    item.Symbol,
			Price:     item.LastPrice,
			Change:    item.PriceChange,
			High:      item.HighPrice24h,
			Low:       item.LowPrice24h,
			Volume:    item.Volume24h,
			UpdatedAt: now,
			Source:    "rest",
		}
	}

	// Stats every minute (avoid log spam)
	if time.Now().Second() < 5 {
		wsCount := 0
		restCount := 0
		for _, t := range b.tickers {
			if t.Source == "ws" {
				wsCount++
			} else {
				restCount++
			}
		}
		log.Printf("bybit tickers: %d total (%d ws, %d rest)", len(b.tickers), wsCount, restCount)
	}
}

// Helper to format the count for logs (used elsewhere)
func (b *BybitClient) Count() string {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return fmt.Sprintf("%d", len(b.tickers))
}
