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

const geminiModel = "gemini-3-flash-preview"
const geminiURL = "https://generativelanguage.googleapis.com/v1beta/models/" + geminiModel + ":generateContent"
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

// geminiRequest / geminiResponse mirror the Gemini REST API structure.
type geminiPart struct {
	Text string `json:"text"`
}

type geminiContent struct {
	Role  string       `json:"role"`
	Parts []geminiPart `json:"parts"`
}

type geminiRequest struct {
	SystemInstruction *geminiContent  `json:"system_instruction,omitempty"`
	Contents          []geminiContent `json:"contents"`
	GenerationConfig  *genConfig      `json:"generationConfig,omitempty"`
}

type genConfig struct {
	MaxOutputTokens int     `json:"maxOutputTokens,omitempty"`
	Temperature     float64 `json:"temperature,omitempty"`
}

type geminiCandidate struct {
	Content geminiContent `json:"content"`
}

type geminiResponse struct {
	Candidates []geminiCandidate `json:"candidates"`
}

// ChatRequest is what the frontend sends.
type ChatRequest struct {
	Messages []ChatMessage `json:"messages" binding:"required"`
}

type ChatMessage struct {
	Role string `json:"role" binding:"required"` // "user" or "model"
	Text string `json:"text" binding:"required"`
}

func ChatHandler(c *gin.Context) {
	apiKey := os.Getenv("GEMINI_API_KEY")
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

	// Build Gemini request with conversation history.
	contents := make([]geminiContent, 0, len(req.Messages))
	for _, m := range req.Messages {
		role := m.Role
		if role == "assistant" {
			role = "model" // Gemini uses "model" not "assistant"
		}
		contents = append(contents, geminiContent{
			Role:  role,
			Parts: []geminiPart{{Text: m.Text}},
		})
	}

	gemReq := geminiRequest{
		SystemInstruction: &geminiContent{
			Parts: []geminiPart{{Text: systemPrompt}},
		},
		Contents: contents,
		GenerationConfig: &genConfig{
			MaxOutputTokens: 1024,
			Temperature:     0.7,
		},
	}

	body, err := json.Marshal(gemReq)
	if err != nil {
		log.Printf("chat: failed to marshal request: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to build request"})
		return
	}

	// Call Gemini API.
	url := geminiURL + "?key=" + apiKey
	resp, err := http.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		log.Printf("chat: failed to call Gemini: %v", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "failed to reach AI service"})
		return
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("chat: failed to read Gemini response: %v", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "failed to read AI response"})
		return
	}

	if resp.StatusCode != 200 {
		log.Printf("chat: Gemini returned %d: %s", resp.StatusCode, string(respBody))
		c.JSON(http.StatusBadGateway, gin.H{
			"error": fmt.Sprintf("AI service returned status %d", resp.StatusCode),
		})
		return
	}

	var gemResp geminiResponse
	if err := json.Unmarshal(respBody, &gemResp); err != nil {
		log.Printf("chat: failed to parse Gemini response: %v", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "failed to parse AI response"})
		return
	}

	if len(gemResp.Candidates) == 0 || len(gemResp.Candidates[0].Content.Parts) == 0 {
		c.JSON(http.StatusBadGateway, gin.H{"error": "AI returned empty response"})
		return
	}

	reply := gemResp.Candidates[0].Content.Parts[0].Text
	c.JSON(http.StatusOK, gin.H{"reply": reply})
}
