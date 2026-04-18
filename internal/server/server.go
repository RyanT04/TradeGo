package server

import (
	"log"

	"github.com/gin-gonic/gin"

	"github.com/RyanT04/TradeGo/internal/auth"
	"github.com/RyanT04/TradeGo/internal/config"
	"github.com/RyanT04/TradeGo/internal/database"
	"github.com/RyanT04/TradeGo/internal/handler"
	"github.com/RyanT04/TradeGo/internal/market"
	"github.com/RyanT04/TradeGo/internal/matching"
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

	// Initialize services
	jwtService := auth.NewJWTService(cfg.JWTSecret)
	bybit := market.NewBybitClient()
	bybit.Connect(defaultSymbols)

	// Initialize matching engine
	engine := matching.NewEngine(db, bybit)

	// Initialize handlers
	marketHandler := handler.NewMarketHandler(bybit)
	authHandler := handler.NewAuthHandler(db, jwtService)
	orderHandler := handler.NewOrderHandler(db, engine)

	s := &Server{
		port:   cfg.Port,
		router: r,
		db:     db,
	}
	s.routes(marketHandler, authHandler, orderHandler, jwtService)
	return s
}

func (s *Server) routes(mh *handler.MarketHandler, ah *handler.AuthHandler, oh *handler.OrderHandler, jwtService *auth.JWTService) {
	s.router.GET("/health", handler.NewHealthHandler(s.db))
	s.router.GET("/ticker", mh.GetTicker)
	s.router.GET("/tickers", mh.GetAllTickers)
	s.router.GET("/kline", handler.GetKline)

	s.router.POST("/auth/register", ah.Register)
	s.router.POST("/auth/login", ah.Login)

	// Protected routes
	protected := s.router.Group("/")
	protected.Use(auth.AuthMiddleware(jwtService))
	{
		protected.GET("/auth/me", ah.Me)
		protected.POST("/order", oh.PlaceOrder)
		protected.GET("/orders", oh.GetOrders)
		protected.GET("/holdings", oh.GetHoldings)
		protected.GET("/balance", oh.GetBalance)
	}
}

func (s *Server) Start() error {
	return s.router.Run(":" + s.port)
}
