package database

import (
	"context"
	"time"
)

type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	Name         string    `json:"name"`
	Username     *string   `json:"username,omitempty"`
	Avatar       *string   `json:"avatar,omitempty"`
	Balance      float64   `json:"balance"`
	Onboarded    bool      `json:"onboarded"`
	CreatedAt    time.Time `json:"created_at"`
}

func (db *DB) CreateUser(email, passwordHash string) (*User, error) {
	user := &User{}
	err := db.Pool.QueryRow(
		context.Background(),
		`INSERT INTO users (email, password_hash)
		 VALUES ($1, $2)
		 RETURNING id, email, password_hash, name, username, avatar, balance, onboarded, created_at`,
		email, passwordHash,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Name, &user.Username, &user.Avatar, &user.Balance, &user.Onboarded, &user.CreatedAt)

	return user, err
}

func (db *DB) GetUserByEmail(email string) (*User, error) {
	user := &User{}
	err := db.Pool.QueryRow(
		context.Background(),
		`SELECT id, email, password_hash, name, username, avatar, balance, onboarded, created_at
		 FROM users WHERE email = $1`,
		email,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Name, &user.Username, &user.Avatar, &user.Balance, &user.Onboarded, &user.CreatedAt)

	return user, err
}

func (db *DB) GetUserByID(id string) (*User, error) {
	user := &User{}
	err := db.Pool.QueryRow(
		context.Background(),
		`SELECT id, email, password_hash, name, username, avatar, balance, onboarded, created_at
		 FROM users WHERE id = $1`,
		id,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Name, &user.Username, &user.Avatar, &user.Balance, &user.Onboarded, &user.CreatedAt)

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
