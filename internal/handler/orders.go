package handler

import (
	"net/http"

	"github.com/RyanT04/TradeGo/internal/database"
	"github.com/RyanT04/TradeGo/internal/matching"
	"github.com/gin-gonic/gin"
)

type OrderHandler struct {
	db     *database.DB
	engine *matching.Engine
}

func NewOrderHandler(db *database.DB, engine *matching.Engine) *OrderHandler {
	return &OrderHandler{db: db, engine: engine}
}

func (h *OrderHandler) PlaceOrder(c *gin.Context) {
	userID := c.GetString("user_id")

	var req struct {
		Symbol   string  `json:"symbol" binding:"required"`
		Side     string  `json:"side" binding:"required"`
		Quantity float64 `json:"quantity" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "symbol, side, and quantity are required"})
		return
	}

	if req.Side != "BUY" && req.Side != "SELL" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "side must be BUY or SELL"})
		return
	}

	if req.Quantity <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "quantity must be positive"})
		return
	}

	var result *matching.TradeResult
	var err error

	if req.Side == "BUY" {
		result, err = h.engine.ExecuteMarketBuy(userID, req.Symbol, req.Quantity)
	} else {
		result, err = h.engine.ExecuteMarketSell(userID, req.Symbol, req.Quantity)
	}

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"trade":      result.Trade,
		"latency_us": result.Latency.Microseconds(),
	})
}

func (h *OrderHandler) GetOrders(c *gin.Context) {
	userID := c.GetString("user_id")

	orders, err := h.db.GetOpenOrders(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get orders"})
		return
	}

	c.JSON(http.StatusOK, orders)
}

func (h *OrderHandler) GetHoldings(c *gin.Context) {
	userID := c.GetString("user_id")

	holdings, err := h.db.GetHoldings(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get holdings"})
		return
	}

	c.JSON(http.StatusOK, holdings)
}

func (h *OrderHandler) GetBalance(c *gin.Context) {
	userID := c.GetString("user_id")

	user, err := h.db.GetUserByID(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"balance": user.Balance,
	})
}

func (h *OrderHandler) GetTrades(c *gin.Context) {
	userID := c.GetString("user_id")

	trades, err := h.db.GetTrades(userID, 100)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get trades"})
		return
	}

	c.JSON(http.StatusOK, trades)
}

func (h *OrderHandler) OpenLeveraged(c *gin.Context) {
	userID := c.GetString("user_id")

	var req struct {
		Symbol    string  `json:"symbol" binding:"required"`
		Direction string  `json:"direction" binding:"required"`
		Leverage  int     `json:"leverage" binding:"required"`
		Margin    float64 `json:"margin" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "symbol, direction, leverage, and margin are required"})
		return
	}

	result, err := h.engine.OpenLeveragedPosition(userID, req.Symbol, req.Direction, req.Leverage, req.Margin)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"position":   result.Position,
		"latency_us": result.Latency.Microseconds(),
	})
}

func (h *OrderHandler) CloseLeveraged(c *gin.Context) {
	userID := c.GetString("user_id")
	positionID := c.Param("id")

	result, err := h.engine.CloseLeveragedPosition(userID, positionID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"position":   result.Position,
		"pnl":        result.PnL,
		"latency_us": result.Latency.Microseconds(),
	})
}

func (h *OrderHandler) GetLeveragedPositions(c *gin.Context) {
	userID := c.GetString("user_id")

	open, err := h.db.GetOpenPositions(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get positions"})
		return
	}

	closed, err := h.db.GetClosedPositions(userID, 50)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get closed positions"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"open":   open,
		"closed": closed,
	})
}
