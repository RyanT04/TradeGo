package handler

import (
	"context"
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/RyanT04/TradeGo/internal/database"
)

type PortfolioHandler struct {
	db *database.DB
}

func NewPortfolioHandler(db *database.DB) *PortfolioHandler {
	return &PortfolioHandler{db: db}
}

func (h *PortfolioHandler) Reset(c *gin.Context) {
	userID := c.GetString("user_id")

	var req struct {
		Balance      float64 `json:"balance" binding:"required,gt=0"`
		ClearHistory bool    `json:"clear_history"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "balance is required and must be greater than 0"})
		return
	}

	ctx := context.Background()
	tx, err := h.db.Pool.Begin(ctx)
	if err != nil {
		log.Printf("portfolio reset: failed to begin tx: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to start transaction"})
		return
	}
	defer tx.Rollback(ctx)

	// Step 1: clear holdings
	if _, err := tx.Exec(ctx, `DELETE FROM holdings WHERE user_id = $1`, userID); err != nil {
		log.Printf("portfolio reset: failed to clear holdings for user %s: %v", userID, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("failed to clear holdings: %v", err),
		})
		return
	}

	// Step 2: clear leveraged positions (both open and closed)
	if _, err := tx.Exec(ctx, `DELETE FROM leveraged_positions WHERE user_id = $1`, userID); err != nil {
		log.Printf("portfolio reset: failed to clear leveraged positions for user %s: %v", userID, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("failed to clear positions: %v", err),
		})
		return
	}

	// Step 3: clear pending orders
	if _, err := tx.Exec(ctx, `DELETE FROM orders WHERE user_id = $1`, userID); err != nil {
		log.Printf("portfolio reset: failed to clear orders for user %s: %v", userID, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("failed to clear orders: %v", err),
		})
		return
	}

	// Step 4: optionally clear trade history
	if req.ClearHistory {
		if _, err := tx.Exec(ctx, `DELETE FROM trades WHERE user_id = $1`, userID); err != nil {
			log.Printf("portfolio reset: failed to clear trade history for user %s: %v", userID, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": fmt.Sprintf("failed to clear trade history: %v", err),
			})
			return
		}
	}

	// Step 5: set new balance
	if _, err := tx.Exec(ctx, `UPDATE users SET balance = $1 WHERE id = $2`, req.Balance, userID); err != nil {
		log.Printf("portfolio reset: failed to update balance for user %s: %v", userID, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("failed to update balance: %v", err),
		})
		return
	}

	if err := tx.Commit(ctx); err != nil {
		log.Printf("portfolio reset: failed to commit for user %s: %v", userID, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("failed to commit reset: %v", err),
		})
		return
	}

	log.Printf("portfolio reset: user %s, new balance $%.2f, history cleared: %v",
		userID, req.Balance, req.ClearHistory)

	c.JSON(http.StatusOK, gin.H{"success": true, "balance": req.Balance})
}
