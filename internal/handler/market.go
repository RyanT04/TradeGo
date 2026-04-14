package handler

import (
	"net/http"

	"github.com/RyanT04/TradeGo/internal/market"
	"github.com/gin-gonic/gin"
)

type MarketHandler struct {
	bybit *market.BybitClient
}

func NewMarketHandler(bybit *market.BybitClient) *MarketHandler {
	return &MarketHandler{bybit: bybit}
}

func (h *MarketHandler) GetTicker(c *gin.Context) {
	symbol := c.Query("symbol")
	if symbol == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "symbol is required"})
		return
	}

	ticker := h.bybit.GetTicker(symbol)
	if ticker == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "symbol not found"})
		return
	}

	c.JSON(http.StatusOK, ticker)
}

func (h *MarketHandler) GetAllTickers(c *gin.Context) {
	c.JSON(http.StatusOK, h.bybit.GetAllTickers())
}
