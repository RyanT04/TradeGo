package email

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"
)

const resendEndpoint = "https://api.resend.com/emails"

type Sender struct {
	apiKey     string
	fromEmail  string
	httpClient *http.Client
}

// NewSender builds an email sender backed by Resend.
//
// If RESEND_API_KEY is absent the sender falls back to dev mode and logs
// messages instead of sending them, so local development doesn't need
// credentials.
func NewSender() *Sender {
	fromEmail := os.Getenv("EMAIL_FROM")
	if fromEmail == "" {
		fromEmail = "TradeGo <noreply@trade-go.tech>"
	}

	apiKey := os.Getenv("RESEND_API_KEY")
	if apiKey == "" {
		log.Println("email: RESEND_API_KEY not set, running in dev mode (emails will be logged)")
	}

	return &Sender{
		apiKey:    apiKey,
		fromEmail: fromEmail,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (s *Sender) SendVerificationEmail(toEmail, token, baseURL string) error {
	verifyURL := fmt.Sprintf("%s/api/auth/verify?token=%s", baseURL, token)

	subject := "Verify your TradeGo account"
	htmlBody := fmt.Sprintf(`
		<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
			<h2 style="color: #10b981;">Trade<span style="color: #111;">Go</span></h2>
			<p>Thanks for signing up! Please verify your email address by clicking the button below:</p>
			<a href="%s" style="display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 16px 0;">
				Verify Email
			</a>
			<p style="color: #888; font-size: 12px; margin-top: 24px;">
				If you didn't create a TradeGo account, you can safely ignore this email.
			</p>
			<p style="color: #666; font-size: 11px;">Or copy this link: %s</p>
		</div>
	`, verifyURL, verifyURL)

	textBody := fmt.Sprintf("Verify your TradeGo account: %s", verifyURL)

	return s.send(toEmail, subject, htmlBody, textBody)
}

func (s *Sender) SendPasswordResetEmail(toEmail, token, baseURL string) error {
	resetURL := fmt.Sprintf("%s/reset-password?token=%s", baseURL, token)

	subject := "Reset your TradeGo password"
	htmlBody := fmt.Sprintf(`
		<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
			<h2 style="color: #10b981;">Trade<span style="color: #111;">Go</span></h2>
			<p>We received a request to reset your password. Click the button below to set a new one:</p>
			<a href="%s" style="display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 16px 0;">
				Reset Password
			</a>
			<p style="color: #888; font-size: 12px; margin-top: 24px;">
				This link expires in 30 minutes. If you didn't request a password reset, you can safely ignore this email.
			</p>
			<p style="color: #666; font-size: 11px;">Or copy this link: %s</p>
		</div>
	`, resetURL, resetURL)

	textBody := fmt.Sprintf("Reset your TradeGo password: %s\nThis link expires in 30 minutes.", resetURL)

	return s.send(toEmail, subject, htmlBody, textBody)
}

type resendRequest struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html"`
	Text    string   `json:"text"`
}

type resendResponse struct {
	ID      string `json:"id"`
	Message string `json:"message"`
	Name    string `json:"name"`
}

func (s *Sender) send(to, subject, htmlBody, textBody string) error {
	if s.apiKey == "" {
		log.Printf("email [DEV]: to=%s subject=%s", to, subject)
		log.Printf("email [DEV]: %s", textBody)
		return nil
	}

	payload, err := json.Marshal(resendRequest{
		From:    s.fromEmail,
		To:      []string{to},
		Subject: subject,
		HTML:    htmlBody,
		Text:    textBody,
	})
	if err != nil {
		return fmt.Errorf("encoding email payload: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, resendEndpoint, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("building email request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		log.Printf("email: failed to send to %s: %v", to, err)
		return fmt.Errorf("sending email: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("reading email response: %w", err)
	}

	// Resend returns a 4xx/5xx with a JSON error body on failure. Checking the
	// status explicitly matters: a request that "succeeds" at the transport
	// level can still have failed to send.
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var apiErr resendResponse
		if jsonErr := json.Unmarshal(body, &apiErr); jsonErr == nil && apiErr.Message != "" {
			log.Printf("email: Resend rejected send to %s (%d): %s", to, resp.StatusCode, apiErr.Message)
			return fmt.Errorf("resend error (%d): %s", resp.StatusCode, apiErr.Message)
		}
		log.Printf("email: Resend rejected send to %s (%d): %s", to, resp.StatusCode, string(body))
		return fmt.Errorf("resend error (%d)", resp.StatusCode)
	}

	var sent resendResponse
	if err := json.Unmarshal(body, &sent); err == nil && sent.ID != "" {
		log.Printf("email: sent '%s' to %s (id=%s)", subject, to, sent.ID)
	} else {
		log.Printf("email: sent '%s' to %s", subject, to)
	}
	return nil
}
