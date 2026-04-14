package server

import (
	"github.com/gin-gonic/gin"

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
}

func New(port string) *Server {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()

	r.Use(gin.Recovery())
	r.Use(middleware.Logger())
	r.Use(middleware.CORS())

	// Start Bybit WebSocket client
	bybit := market.NewBybitClient()
	bybit.Connect(defaultSymbols)

	marketHandler := handler.NewMarketHandler(bybit)

	s := &Server{
		port:   port,
		router: r,
	}
	s.routes(marketHandler)
	return s
}

func (s *Server) routes(mh *handler.MarketHandler) {
	s.router.GET("/health", handler.Health)
	s.router.GET("/ticker", mh.GetTicker)
	s.router.GET("/tickers", mh.GetAllTickers)
}

func (s *Server) Start() error {
	return s.router.Run(":" + s.port)
}
