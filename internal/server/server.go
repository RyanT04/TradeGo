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

	// Matching engine + background liquidation worker
	engine := matching.NewEngine(db, bybit)
	engine.StartLiquidationWorker()

	// Handlers
	marketHandler := handler.NewMarketHandler(bybit)
	authHandler := handler.NewAuthHandler(db, jwtService)
	orderHandler := handler.NewOrderHandler(db, engine)
	favouritesHandler := handler.NewFavouritesHandler(db)
	portfolioHandler := handler.NewPortfolioHandler(db)

	s := &Server{
		port:   cfg.Port,
		router: r,
		db:     db,
	}
	s.routes(marketHandler, authHandler, orderHandler, favouritesHandler, portfolioHandler, jwtService)
	s.serveStatic() // SPA fallback for non-API routes
	return s
}

func (s *Server) routes(
	mh *handler.MarketHandler,
	ah *handler.AuthHandler,
	oh *handler.OrderHandler,
	fh *handler.FavouritesHandler,
	ph *handler.PortfolioHandler,
	jwtService *auth.JWTService,
) {
	// All API routes are namespaced under /api
	api := s.router.Group("/api")
	{
		api.GET("/health", handler.NewHealthHandler(s.db))
		api.GET("/ticker", mh.GetTicker)
		api.GET("/tickers", mh.GetAllTickers)
		api.GET("/kline", handler.GetKline)

		api.POST("/auth/register", ah.Register)
		api.POST("/auth/login", ah.Login)

		// Protected routes
		protected := api.Group("/")
		protected.Use(auth.AuthMiddleware(jwtService))
		{
			protected.GET("/auth/me", ah.Me)
			protected.PATCH("/auth/profile", ah.UpdateProfile)
			protected.PATCH("/auth/balance", ah.SetStartingBalance)
			protected.POST("/auth/change-password", ah.ChangePassword)

			protected.POST("/order", oh.PlaceOrder)
			protected.GET("/orders", oh.GetOrders)
			protected.GET("/holdings", oh.GetHoldings)
			protected.GET("/balance", oh.GetBalance)
			protected.GET("/trades", oh.GetTrades)

			// Leveraged trading
			protected.POST("/leveraged/open", oh.OpenLeveraged)
			protected.POST("/leveraged/close/:id", oh.CloseLeveraged)
			protected.GET("/leveraged", oh.GetLeveragedPositions)

			// Favourites
			protected.GET("/favourites", fh.GetFavourites)
			protected.POST("/favourites", fh.AddFavourite)
			protected.DELETE("/favourites/:symbol", fh.RemoveFavourite)

			// Portfolio
			protected.POST("/portfolio/reset", ph.Reset)

			//AI chat
			protected.POST("/chat", handler.ChatHandler)
		}
	}

	// Backward-compatible health check at the root, useful for ALB/health probes
	s.router.GET("/health", handler.NewHealthHandler(s.db))
}

func (s *Server) Start() error {
	return s.router.Run(":" + s.port)
}
