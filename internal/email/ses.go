package email

import (
	"fmt"
	"log"
	"os"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/ses"
)

type Sender struct {
	client    *ses.SES
	fromEmail string
}

func NewSender() *Sender {
	fromEmail := os.Getenv("SES_FROM_EMAIL")
	if fromEmail == "" {
		fromEmail = "noreply@trade-go.tech"
	}

	// If SES_ENABLED is not set, run in dev mode (log only)
	if os.Getenv("SES_ENABLED") != "true" {
		log.Println("email: SES_ENABLED not set, running in dev mode (emails will be logged)")
		return &Sender{client: nil, fromEmail: fromEmail}
	}

	region := os.Getenv("AWS_REGION")
	if region == "" {
		region = "eu-west-2"
	}

	sess, err := session.NewSession(&aws.Config{
		Region: aws.String(region),
	})
	if err != nil {
		log.Printf("email: failed to create AWS session: %v (emails will be logged only)", err)
		return &Sender{client: nil, fromEmail: fromEmail}
	}

	return &Sender{
		client:    ses.New(sess),
		fromEmail: fromEmail,
	}
}

func (s *Sender) SendVerificationEmail(toEmail, token, baseURL string) error {
	verifyURL := fmt.Sprintf("%s/api/auth/verify?token=%s", baseURL, token)

	subject := "Verify your TradeGo account"
	htmlBody := fmt.Sprintf(`
		<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
			<h2 style="color: #10b981;">Trade<span style="color: #fff;">Go</span></h2>
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
			<h2 style="color: #10b981;">Trade<span style="color: #fff;">Go</span></h2>
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

func (s *Sender) send(to, subject, htmlBody, textBody string) error {
	// If SES is not configured (local dev), just log the email
	if s.client == nil {
		log.Printf("email [DEV]: to=%s subject=%s", to, subject)
		log.Printf("email [DEV]: would have sent HTML email")
		return nil
	}

	input := &ses.SendEmailInput{
		Source: aws.String(s.fromEmail),
		Destination: &ses.Destination{
			ToAddresses: []*string{aws.String(to)},
		},
		Message: &ses.Message{
			Subject: &ses.Content{
				Charset: aws.String("UTF-8"),
				Data:    aws.String(subject),
			},
			Body: &ses.Body{
				Html: &ses.Content{
					Charset: aws.String("UTF-8"),
					Data:    aws.String(htmlBody),
				},
				Text: &ses.Content{
					Charset: aws.String("UTF-8"),
					Data:    aws.String(textBody),
				},
			},
		},
	}

	_, err := s.client.SendEmail(input)
	if err != nil {
		log.Printf("email: failed to send to %s: %v", to, err)
		return fmt.Errorf("failed to send email: %w", err)
	}

	log.Printf("email: sent '%s' to %s", subject, to)
	return nil
}
