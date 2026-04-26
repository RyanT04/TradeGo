package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/RyanT04/TradeGo/internal/database"
)

type FavouritesHandler struct {
	db *database.DB
}

func NewFavouritesHandler(db *database.DB) *FavouritesHandler {
	return &FavouritesHandler{db: db}
}

func (h *FavouritesHandler) GetFavourites(c *gin.Context) {
	userID := c.GetString("user_id")
	favs, err := h.db.GetFavourites(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get favourites"})
		return
	}
	c.JSON(http.StatusOK, favs)
}

func (h *FavouritesHandler) AddFavourite(c *gin.Context) {
	userID := c.GetString("user_id")

	var req struct {
		Symbol string `json:"symbol" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "symbol is required"})
		return
	}

	if err := h.db.AddFavourite(userID, req.Symbol); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add favourite"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *FavouritesHandler) RemoveFavourite(c *gin.Context) {
	userID := c.GetString("user_id")
	symbol := c.Param("symbol")

	if err := h.db.RemoveFavourite(userID, symbol); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to remove favourite"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}
