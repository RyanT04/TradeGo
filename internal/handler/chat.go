package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

const claudeModel = "claude-sonnet-4-6"
const claudeURL = "https://api.anthropic.com/v1/messages"
const claudeAPIVersion = "2023-06-01"

const systemPrompt = `You are TradeGo Assistant, an AI tutor built into TradeGo — a cryptocurrency trading simulator.

Your role:
- Help users learn cryptocurrency trading concepts: order types, leverage, liquidation, risk management, portfolio diversification, chart reading, candlestick patterns, support/resistance, and trading psychology.
- Explain TradeGo features: spot trading, leveraged trading (2x-50x), portfolio reset, favourites, the performance/latency card, and the markets page.
- Be encouraging but honest about risks. Remind users that real trading involves fees, slippage, and emotional pressure that the simulator doesn't fully replicate.
- Keep answers concise (2-4 paragraphs max). Use simple language suitable for beginners.
- If asked about specific coins or price predictions, explain that you cannot predict prices and that no one can reliably do so.
- If asked about topics unrelated to trading or TradeGo, politely redirect: "I'm best at helping with trading concepts and TradeGo features. What would you like to learn about trading?"

TradeGo facts you know:
- TradeGo supports 460+ USDT trading pairs with live Bybit market data.
- Spot trading: buy and sell crypto with virtual money. No fees.
- Leveraged trading: 2x to 50x, LONG or SHORT. Positions are automatically liquidated if the price crosses the liquidation level.
- Portfolio starts at a user-chosen balance ($1,000 / $10,000 / $100,000). Can be reset up to 3 times per day in Settings.
- Every trade shows execution latency in microseconds.
- Built with Go (backend) and React (frontend), deployed on AWS.`

// Claude API request/response types.
type claudeMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type claudeRequest struct {
	Model     string          `json:"model"`
	MaxTokens int             `json:"max_tokens"`
	System    string          `json:"system,omitempty"`
	Messages  []claudeMessage `json:"messages"`
}

type claudeContentBlock struct {
	Type string `json:"type"`
	Text string `json:"text,omitempty"`
}

type claudeResponse struct {
	Content []claudeContentBlock `json:"content"`
	Error   *claudeError         `json:"error,omitempty"`
}

type claudeError struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

// ChatRequest is what the frontend sends.
type ChatRequest struct {
	Messages []ChatMessage `json:"messages" binding:"required"`
}

type ChatMessage struct {
	Role string `json:"role" binding:"required"` // "user" or "model"/"assistant"
	Text string `json:"text" binding:"required"`
}

func ChatHandler(c *gin.Context) {
	apiKey := os.Getenv("CLAUDE_API_KEY")
	if apiKey == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "chat is not configured"})
		return
	}

	var req ChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "messages array is required"})
		return
	}

	if len(req.Messages) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "at least one message is required"})
		return
	}

	// Build Claude messages from conversation history.
	messages := make([]claudeMessage, 0, len(req.Messages))
	for _, m := range req.Messages {
		role := m.Role
		// Normalise role names — frontend may send "model" (Gemini legacy) or "assistant"
		if role == "model" {
			role = "assistant"
		}
		messages = append(messages, claudeMessage{
			Role:    role,
			Content: m.Text,
		})
	}

	claudeReq := claudeRequest{
		Model:     claudeModel,
		MaxTokens: 1024,
		System:    systemPrompt,
		Messages:  messages,
	}

	body, err := json.Marshal(claudeReq)
	if err != nil {
		log.Printf("chat: failed to marshal request: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to build request"})
		return
	}

	// Call Claude API.
	httpReq, err := http.NewRequest("POST", claudeURL, bytes.NewReader(body))
	if err != nil {
		log.Printf("chat: failed to create request: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create request"})
		return
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", apiKey)
	httpReq.Header.Set("anthropic-version", claudeAPIVersion)

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		log.Printf("chat: failed to call Claude: %v", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "failed to reach AI service"})
		return
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("chat: failed to read Claude response: %v", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "failed to read AI response"})
		return
	}

	if resp.StatusCode != 200 {
		log.Printf("chat: Claude returned %d: %s", resp.StatusCode, string(respBody))
		c.JSON(http.StatusBadGateway, gin.H{
			"error": fmt.Sprintf("AI service returned status %d", resp.StatusCode),
		})
		return
	}

	var claudeResp claudeResponse
	if err := json.Unmarshal(respBody, &claudeResp); err != nil {
		log.Printf("chat: failed to parse Claude response: %v", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "failed to parse AI response"})
		return
	}

	if claudeResp.Error != nil {
		log.Printf("chat: Claude error: %s", claudeResp.Error.Message)
		c.JSON(http.StatusBadGateway, gin.H{"error": claudeResp.Error.Message})
		return
	}

	// Extract text from content blocks.
	reply := ""
	for _, block := range claudeResp.Content {
		if block.Type == "text" {
			reply += block.Text
		}
	}

	if reply == "" {
		c.JSON(http.StatusBadGateway, gin.H{"error": "AI returned empty response"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"reply": reply})
}
