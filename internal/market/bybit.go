package market

import (
	"encoding/json"
	"log"
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
}

type BybitClient struct {
	mu      sync.RWMutex
	tickers map[string]*Ticker
}

func NewBybitClient() *BybitClient {
	return &BybitClient{
		tickers: make(map[string]*Ticker),
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

func (b *BybitClient) Connect(symbols []string) {
	go b.run(symbols)
}

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
		b.handleMessage(msg)
	}
}

func (b *BybitClient) handleMessage(msg []byte) {
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

	b.mu.Lock()
	b.tickers[ticker.Symbol] = &ticker
	b.mu.Unlock()
}
