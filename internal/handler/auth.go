package handler

import (
	"crypto/rand"
	"encoding/hex"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/RyanT04/TradeGo/internal/auth"
	"github.com/RyanT04/TradeGo/internal/database"
	"github.com/RyanT04/TradeGo/internal/email"
	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	db     *database.DB
	jwt    *auth.JWTService
	mailer *email.Sender
}

func NewAuthHandler(db *database.DB, jwt *auth.JWTService, mailer *email.Sender) *AuthHandler {
	return &AuthHandler{db: db, jwt: jwt, mailer: mailer}
}

// generateToken creates a cryptographically secure random token.
func generateToken(nBytes int) string {
	b := make([]byte, nBytes)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// baseURL returns the public-facing URL for email links.
func baseURL() string {
	if u := os.Getenv("BASE_URL"); u != "" {
		return u
	}
	return "https://trade-go.tech"
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req struct {
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid email and password required"})
		return
	}

	// Validate password strength
	if err := auth.ValidatePassword(req.Password); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}

	user, err := h.db.CreateUser(req.Email, hash)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "email already exists"})
		return
	}

	// Generate and store verification token
	verifyToken := generateToken(32)
	if err := h.db.SetVerificationToken(user.ID, verifyToken); err != nil {
		log.Printf("register: failed to set verification token for %s: %v", user.Email, err)
	} else {
		// Send verification email (non-blocking — don't fail registration if email fails)
		go func() {
			if err := h.mailer.SendVerificationEmail(user.Email, verifyToken, baseURL()); err != nil {
				log.Printf("register: failed to send verification email to %s: %v", user.Email, err)
			}
		}()
	}

	token, err := h.jwt.GenerateToken(user.ID, user.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"token": token,
		"user":  user,
	})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req struct {
		Email    string `json:"email" binding:"required"`
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email and password are required"})
		return
	}

	user, err := h.db.GetUserByEmail(req.Email)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	if !auth.CheckPassword(req.Password, user.PasswordHash) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	token, err := h.jwt.GenerateToken(user.ID, user.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user":  user,
	})
}

func (h *AuthHandler) Me(c *gin.Context) {
	userID := c.GetString("user_id")

	user, err := h.db.GetUserByID(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	c.JSON(http.StatusOK, user)
}

func (h *AuthHandler) UpdateProfile(c *gin.Context) {
	userID := c.GetString("user_id")

	var req struct {
		Username string `json:"username" binding:"required,min=3,max=20"`
		Avatar   string `json:"avatar" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "username (3-20 chars) and avatar are required"})
		return
	}

	taken, err := h.db.CheckUsernameTaken(req.Username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check username"})
		return
	}
	if taken {
		c.JSON(http.StatusConflict, gin.H{"error": "username already taken"})
		return
	}

	if err := h.db.UpdateProfile(userID, req.Username, req.Avatar); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update profile"})
		return
	}

	user, _ := h.db.GetUserByID(userID)
	c.JSON(http.StatusOK, user)
}

func (h *AuthHandler) SetStartingBalance(c *gin.Context) {
	userID := c.GetString("user_id")

	var req struct {
		Balance float64 `json:"balance" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "balance is required"})
		return
	}

	allowed := map[float64]bool{1000: true, 10000: true, 100000: true}
	if !allowed[req.Balance] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "balance must be 1000, 10000, or 100000"})
		return
	}

	if err := h.db.SetStartingBalance(userID, req.Balance); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to set balance"})
		return
	}

	user, _ := h.db.GetUserByID(userID)
	c.JSON(http.StatusOK, user)
}

func (h *AuthHandler) ChangePassword(c *gin.Context) {
	userID := c.GetString("user_id")

	var req struct {
		CurrentPassword string `json:"current_password" binding:"required"`
		NewPassword     string `json:"new_password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "current and new passwords required"})
		return
	}

	// Validate new password strength
	if err := auth.ValidatePassword(req.NewPassword); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.db.GetUserByID(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	if !auth.CheckPassword(req.CurrentPassword, user.PasswordHash) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "current password is incorrect"})
		return
	}

	hash, err := auth.HashPassword(req.NewPassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}

	if err := h.db.UpdatePassword(userID, hash); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update password"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// VerifyEmail handles GET /api/auth/verify?token=xxx
// Marks the user's email as verified and redirects to the app.
func (h *AuthHandler) VerifyEmail(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "verification token is required"})
		return
	}

	user, err := h.db.VerifyEmail(token)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid or expired verification link"})
		return
	}

	log.Printf("email verified: user %s (%s)", user.ID, user.Email)

	// Redirect into the app. If the user hasn't finished profile setup and
	// balance selection, the frontend routes them into onboarding from here.
	c.Redirect(http.StatusFound, baseURL()+"/verified")
}

// ResendVerification handles POST /api/auth/resend-verification (protected)
// Generates a new token and resends the verification email.
func (h *AuthHandler) ResendVerification(c *gin.Context) {
	userID := c.GetString("user_id")

	user, err := h.db.GetUserByID(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	if user.EmailVerified {
		c.JSON(http.StatusOK, gin.H{"message": "email is already verified"})
		return
	}

	verifyToken := generateToken(32)
	if err := h.db.SetVerificationToken(userID, verifyToken); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate verification token"})
		return
	}

	if err := h.mailer.SendVerificationEmail(user.Email, verifyToken, baseURL()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to send verification email"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "verification email sent"})
}

// ForgotPassword handles POST /api/auth/forgot-password (public)
// Sends a password reset email if the email exists.
func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required,email"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid email is required"})
		return
	}

	// Always respond with success to prevent email enumeration
	user, err := h.db.GetUserByEmail(req.Email)
	if err != nil {
		// User not found — still say success to avoid revealing whether the email exists
		c.JSON(http.StatusOK, gin.H{"message": "if an account exists with that email, a reset link has been sent"})
		return
	}

	resetToken := generateToken(32)
	expires := time.Now().Add(30 * time.Minute)

	if err := h.db.SetResetToken(user.Email, resetToken, expires); err != nil {
		log.Printf("forgot-password: failed to set reset token for %s: %v", user.Email, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to process request"})
		return
	}

	go func() {
		if err := h.mailer.SendPasswordResetEmail(user.Email, resetToken, baseURL()); err != nil {
			log.Printf("forgot-password: failed to send reset email to %s: %v", user.Email, err)
		}
	}()

	c.JSON(http.StatusOK, gin.H{"message": "if an account exists with that email, a reset link has been sent"})
}

// ResetPassword handles POST /api/auth/reset-password (public)
// Validates the reset token and sets a new password.
func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req struct {
		Token       string `json:"token" binding:"required"`
		NewPassword string `json:"new_password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "token and new password are required"})
		return
	}

	// Validate new password strength
	if err := auth.ValidatePassword(req.NewPassword); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.db.GetUserByResetToken(req.Token)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid or expired reset link"})
		return
	}

	hash, err := auth.HashPassword(req.NewPassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}

	if err := h.db.UpdatePassword(user.ID, hash); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update password"})
		return
	}

	// Clear the reset token so it can't be reused
	_ = h.db.ClearResetToken(user.ID)

	log.Printf("password reset: user %s (%s)", user.ID, user.Email)

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "password has been reset. you can now log in with your new password."})
}
