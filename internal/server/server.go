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

// defaultSymbols mirrors the 20 popular coins from TradeX (COINGECKO_TO_BYBIT map)
// to keep the latency comparison fair and consistent between both simulators.
var defaultSymbols = []string{
	"BTCUSDT",   // bitcoin
	"ETHUSDT",   // ethereum
	"SOLUSDT",   // solana
	"BNBUSDT",   // binancecoin
	"XRPUSDT",   // ripple
	"ADAUSDT",   // cardano
	"DOGEUSDT",  // dogecoin
	"AVAXUSDT",  // avalanche
	"DOTUSDT",   // polkadot
	"MATICUSDT", // matic-network
	"LINKUSDT",  // chainlink
	"UNIUSDT",   // uniswap
	"LTCUSDT",   // litecoin
	"ATOMUSDT",  // cosmos
	"NEARUSDT",  // near-protocol
	"APTUSDT",   // aptos
	"ARBUSDT",   // arbitrum
	"OPUSDT",    // optimism
	"INJUSDT",   // injective-protocol
	"SUIUSDT",   // sui
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

	// Initialize matching engine and start background liquidation worker
	engine := matching.NewEngine(db, bybit)
	engine.StartLiquidationWorker()

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
		protected.PATCH("/auth/profile", ah.UpdateProfile)
		protected.PATCH("/auth/balance", ah.SetStartingBalance)

		protected.POST("/order", oh.PlaceOrder)
		protected.GET("/orders", oh.GetOrders)
		protected.GET("/holdings", oh.GetHoldings)
		protected.GET("/balance", oh.GetBalance)
		protected.GET("/trades", oh.GetTrades)

		// Leveraged trading
		protected.POST("/leveraged/open", oh.OpenLeveraged)
		protected.POST("/leveraged/close/:id", oh.CloseLeveraged)
		protected.GET("/leveraged", oh.GetLeveragedPositions)
	}
}

func (s *Server) Start() error {
	return s.router.Run(":" + s.port)
}
