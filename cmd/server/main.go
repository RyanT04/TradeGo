package main

import (
	"log"
	"os"

	"github.com/RyanT04/TradeGo/internal/server"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	srv := server.New(port)

	log.Printf("TradeGo server starting on :%s", port)
	if err := srv.Start(); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}
