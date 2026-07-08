package database

import (
	"context"
	"time"
)

type User struct {
	ID            string    `json:"id"`
	Email         string    `json:"email"`
	PasswordHash  string    `json:"-"`
	Name          string    `json:"name"`
	Username      *string   `json:"username,omitempty"`
	Avatar        *string   `json:"avatar,omitempty"`
	Balance       float64   `json:"balance"`
	Onboarded     bool      `json:"onboarded"`
	EmailVerified bool      `json:"email_verified"`
	CreatedAt     time.Time `json:"created_at"`
}

func (db *DB) CreateUser(email, passwordHash string) (*User, error) {
	user := &User{}
	err := db.Pool.QueryRow(
		context.Background(),
		`INSERT INTO users (email, password_hash)
		 VALUES ($1, $2)
		 RETURNING id, email, password_hash, name, username, avatar, balance, onboarded, COALESCE(email_verified, FALSE), created_at`,
		email, passwordHash,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Name, &user.Username, &user.Avatar, &user.Balance, &user.Onboarded, &user.EmailVerified, &user.CreatedAt)

	return user, err
}

func (db *DB) GetUserByEmail(email string) (*User, error) {
	user := &User{}
	err := db.Pool.QueryRow(
		context.Background(),
		`SELECT id, email, password_hash, name, username, avatar, balance, onboarded, COALESCE(email_verified, FALSE), created_at
		 FROM users WHERE email = $1`,
		email,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Name, &user.Username, &user.Avatar, &user.Balance, &user.Onboarded, &user.EmailVerified, &user.CreatedAt)

	return user, err
}

func (db *DB) GetUserByID(id string) (*User, error) {
	user := &User{}
	err := db.Pool.QueryRow(
		context.Background(),
		`SELECT id, email, password_hash, name, username, avatar, balance, onboarded, COALESCE(email_verified, FALSE), created_at
		 FROM users WHERE id = $1`,
		id,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Name, &user.Username, &user.Avatar, &user.Balance, &user.Onboarded, &user.EmailVerified, &user.CreatedAt)

	return user, err
}

func (db *DB) UpdateProfile(userID, username, avatar string) error {
	_, err := db.Pool.Exec(
		context.Background(),
		`UPDATE users SET username = $1, avatar = $2 WHERE id = $3`,
		username, avatar, userID,
	)
	return err
}

func (db *DB) SetStartingBalance(userID string, balance float64) error {
	_, err := db.Pool.Exec(
		context.Background(),
		`UPDATE users SET balance = $1, onboarded = TRUE WHERE id = $2`,
		balance, userID,
	)
	return err
}

func (db *DB) CheckUsernameTaken(username string) (bool, error) {
	var exists bool
	err := db.Pool.QueryRow(
		context.Background(),
		`SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)`,
		username,
	).Scan(&exists)
	return exists, err
}

func (db *DB) UpdatePassword(userID, newPasswordHash string) error {
	_, err := db.Pool.Exec(
		context.Background(),
		`UPDATE users SET password_hash = $1 WHERE id = $2`,
		newPasswordHash, userID,
	)
	return err
}

// --- Email verification ---

func (db *DB) SetVerificationToken(userID, token string) error {
	_, err := db.Pool.Exec(
		context.Background(),
		`UPDATE users SET verification_token = $1 WHERE id = $2`,
		token, userID,
	)
	return err
}

func (db *DB) VerifyEmail(token string) (*User, error) {
	user := &User{}
	err := db.Pool.QueryRow(
		context.Background(),
		`UPDATE users SET email_verified = TRUE, verification_token = NULL
		 WHERE verification_token = $1
		 RETURNING id, email, password_hash, name, username, avatar, balance, onboarded, email_verified, created_at`,
		token,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Name, &user.Username, &user.Avatar, &user.Balance, &user.Onboarded, &user.EmailVerified, &user.CreatedAt)

	return user, err
}

// --- Password reset ---

func (db *DB) SetResetToken(email, token string, expires time.Time) error {
	_, err := db.Pool.Exec(
		context.Background(),
		`UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE email = $3`,
		token, expires, email,
	)
	return err
}

func (db *DB) GetUserByResetToken(token string) (*User, error) {
	user := &User{}
	err := db.Pool.QueryRow(
		context.Background(),
		`SELECT id, email, password_hash, name, username, avatar, balance, onboarded, COALESCE(email_verified, FALSE), created_at
		 FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()`,
		token,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Name, &user.Username, &user.Avatar, &user.Balance, &user.Onboarded, &user.EmailVerified, &user.CreatedAt)

	return user, err
}

func (db *DB) ClearResetToken(userID string) error {
	_, err := db.Pool.Exec(
		context.Background(),
		`UPDATE users SET reset_token = NULL, reset_token_expires = NULL WHERE id = $1`,
		userID,
	)
	return err
}

// --- Resend verification ---

func (db *DB) GetVerificationToken(userID string) (string, error) {
	var token string
	err := db.Pool.QueryRow(
		context.Background(),
		`SELECT COALESCE(verification_token, '') FROM users WHERE id = $1`,
		userID,
	).Scan(&token)
	return token, err
}
