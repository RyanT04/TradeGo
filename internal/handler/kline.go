package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
)

func GetKline(c *gin.Context) {
	symbol := c.Query("symbol")
	if symbol == "" {
		symbol = "BTCUSDT"
	}
	interval := c.Query("interval")
	if interval == "" {
		interval = "60"
	}
	limit := c.Query("limit")
	if limit == "" {
		limit = "100"
	}

	url := fmt.Sprintf("https://api.bybit.com/v5/market/kline?category=spot&symbol=%s&interval=%s&limit=%s",
		symbol, interval, limit)

	resp, err := http.Get(url)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "failed to fetch kline data"})
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	var result map[string]any
	json.Unmarshal(body, &result)

	c.JSON(http.StatusOK, result)
}
