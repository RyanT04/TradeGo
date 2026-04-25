package config

import (
	"fmt"
	"os"
)

type Config struct {
	Port        string
	DatabaseURL string
	JWTSecret   string
}

func Load() *Config {
	return &Config{
		Port:        getEnv("PORT", "8080"),
		DatabaseURL: buildDatabaseURL(),
		JWTSecret:   getEnv("JWT_SECRET", "tradego-dev-secret"),
	}
}

func buildDatabaseURL() string {
	// If DATABASE_URL is set explicitly (local Docker dev), use it directly
	if url, ok := os.LookupEnv("DATABASE_URL"); ok {
		return url
	}

	// Otherwise build from individual env vars (production / AWS)
	host := getEnv("DB_HOST", "localhost")
	port := getEnv("DB_PORT", "5432")
	user := getEnv("DB_USER", "tradego")
	pass := getEnv("DB_PASSWORD", "tradego123")
	name := getEnv("DB_NAME", "tradego")

	return fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=require",
		user, pass, host, port, name)
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok {
		return v
	}
	return fallback
}
