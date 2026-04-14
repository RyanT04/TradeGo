package handler

import (
	"net/http"
	"time"

	"github.com/RyanT04/TradeGo/internal/database"
	"github.com/gin-gonic/gin"
)

func NewHealthHandler(db *database.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		dbStatus := "ok"
		if err := db.Health(); err != nil {
			dbStatus = "error: " + err.Error()
		}

		c.JSON(http.StatusOK, gin.H{
			"status":   "ok",
			"service":  "TradeGo",
			"database": dbStatus,
			"time":     time.Now().UTC(),
		})
	}
}
