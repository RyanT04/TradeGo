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
	Balance      float64   `json:"balance"`
	CreatedAt    time.Time `json:"created_at"`
}

func (db *DB) CreateUser(email, passwordHash, name string) (*User, error) {
	user := &User{}
	err := db.Pool.QueryRow(
		context.Background(),
		`INSERT INTO users (email, password_hash, name)
		 VALUES ($1, $2, $3)
		 RETURNING id, email, password_hash, name, balance, created_at`,
		email, passwordHash, name,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Name, &user.Balance, &user.CreatedAt)

	if err != nil {
		return nil, err
	}
	return user, nil
}

func (db *DB) GetUserByEmail(email string) (*User, error) {
	user := &User{}
	err := db.Pool.QueryRow(
		context.Background(),
		`SELECT id, email, password_hash, name, balance, created_at
		 FROM users WHERE email = $1`,
		email,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Name, &user.Balance, &user.CreatedAt)

	if err != nil {
		return nil, err
	}
	return user, nil
}

func (db *DB) GetUserByID(id string) (*User, error) {
	user := &User{}
	err := db.Pool.QueryRow(
		context.Background(),
		`SELECT id, email, password_hash, name, balance, created_at
		 FROM users WHERE id = $1`,
		id,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Name, &user.Balance, &user.CreatedAt)

	if err != nil {
		return nil, err
	}
	return user, nil
}
