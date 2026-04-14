package main

import (
	"log"

	"github.com/RyanT04/TradeGo/internal/config"
	"github.com/RyanT04/TradeGo/internal/server"
)

func main() {
	cfg := config.Load()

	srv := server.New(cfg)

	log.Printf("TradeGo server starting on :%s", cfg.Port)
	if err := srv.Start(); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}
