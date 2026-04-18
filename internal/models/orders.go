package models

import "time"

type Order struct {
	ID        string     `json:"id"`
	UserID    string     `json:"user_id"`
	Symbol    string     `json:"symbol"`
	Side      string     `json:"side"`
	Type      string     `json:"type"`
	Quantity  float64    `json:"quantity"`
	Price     float64    `json:"price"`
	Status    string     `json:"status"`
	CreatedAt time.Time  `json:"created_at"`
	FilledAt  *time.Time `json:"filled_at,omitempty"`
}

type Trade struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Symbol    string    `json:"symbol"`
	Side      string    `json:"side"`
	Quantity  float64   `json:"quantity"`
	Price     float64   `json:"price"`
	Total     float64   `json:"total"`
	CreatedAt time.Time `json:"created_at"`
}

type Holding struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	Symbol      string    `json:"symbol"`
	Quantity    float64   `json:"quantity"`
	AvgBuyPrice float64   `json:"avg_buy_price"`
	UpdatedAt   time.Time `json:"updated_at"`
}
