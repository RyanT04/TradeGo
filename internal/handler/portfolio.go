package handler

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/RyanT04/TradeGo/internal/database"
)

// Portfolio reset bounds. Caps prevent users from setting unrealistic balances
// that could trigger overflow or undermine the educational purpose of the app.
const (
	resetBalanceMin = 1.0
	resetBalanceMax = 100_000_000.0 // one hundred million USD
	resetDailyLimit = 3
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

	// Bounds check — reject obvious abuse.
	if req.Balance < resetBalanceMin {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("balance must be at least $%.0f", resetBalanceMin),
		})
		return
	}
	if req.Balance > resetBalanceMax {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("balance cannot exceed $%s", formatBigInt(resetBalanceMax)),
		})
		return
	}

	ctx := context.Background()

	// Rate limit: check how many resets the user has done today.
	var resetCount int
	var resetDate *string
	err := h.db.Pool.QueryRow(ctx,
		`SELECT COALESCE(reset_count, 0), reset_count_date::text FROM users WHERE id = $1`, userID,
	).Scan(&resetCount, &resetDate)
	if err != nil {
		log.Printf("portfolio reset: failed to read reset count for user %s: %v", userID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check reset limit"})
		return
	}

	today := time.Now().UTC().Format("2006-01-02")
	if resetDate != nil && *resetDate == today && resetCount >= resetDailyLimit {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error": fmt.Sprintf("you can only reset your portfolio %d times per day", resetDailyLimit),
		})
		return
	}

	tx, txErr := h.db.Pool.Begin(ctx)
	if txErr != nil {
		log.Printf("portfolio reset: failed to begin tx: %v", txErr)
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

	// Step 2: clear leveraged positions
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

	// Step 6: update reset counter
	if resetDate != nil && *resetDate == today {
		if _, err := tx.Exec(ctx, `UPDATE users SET reset_count = reset_count + 1 WHERE id = $1`, userID); err != nil {
			log.Printf("portfolio reset: failed to increment reset count for user %s: %v", userID, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update reset counter"})
			return
		}
	} else {
		if _, err := tx.Exec(ctx, `UPDATE users SET reset_count = 1, reset_count_date = CURRENT_DATE WHERE id = $1`, userID); err != nil {
			log.Printf("portfolio reset: failed to reset counter for user %s: %v", userID, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update reset counter"})
			return
		}
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

// formatBigInt formats a float as a comma-separated integer string for error messages.
func formatBigInt(v float64) string {
	n := int64(v)
	s := fmt.Sprintf("%d", n)
	out := ""
	for i, c := range s {
		if i > 0 && (len(s)-i)%3 == 0 {
			out += ","
		}
		out += string(c)
	}
	return out
}
