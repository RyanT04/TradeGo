package server

import (
	"log"

	"github.com/gin-gonic/gin"

	"github.com/RyanT04/TradeGo/internal/config"
	"github.com/RyanT04/TradeGo/internal/database"
	"github.com/RyanT04/TradeGo/internal/handler"
	"github.com/RyanT04/TradeGo/internal/market"
	"github.com/RyanT04/TradeGo/internal/middleware"
)

var defaultSymbols = []string{
	"BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "DOGEUSDT",
	"ADAUSDT", "AVAXUSDT", "DOTUSDT", "LINKUSDT", "MATICUSDT",
}

type Server struct {
	port   string
	router *gin.Engine
	db     *database.DB
}

func New(cfg *config.Config) *Server {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()

	r.Use(gin.Recovery())
	r.Use(middleware.Logger())
	r.Use(middleware.CORS())

	// Connect to database
	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	log.Println("Connected to PostgreSQL")

	// Start Bybit WebSocket client
	bybit := market.NewBybitClient()
	bybit.Connect(defaultSymbols)

	marketHandler := handler.NewMarketHandler(bybit)

	s := &Server{
		port:   cfg.Port,
		router: r,
		db:     db,
	}
	s.routes(marketHandler)
	return s
}

func (s *Server) routes(mh *handler.MarketHandler) {
	s.router.GET("/health", handler.NewHealthHandler(s.db))
	s.router.GET("/ticker", mh.GetTicker)
	s.router.GET("/tickers", mh.GetAllTickers)
}

func (s *Server) Start() error {
	return s.router.Run(":" + s.port)
}
