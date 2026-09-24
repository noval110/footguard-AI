package config

import (
	"errors"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL    string
	JWTSecret      string
	Port           string
	FrontendOrigin string
	AIServiceURL   string
	UploadDir      string
	AIModelVersion string
}

func Load() (Config, error) {
	_ = godotenv.Load()
	c := Config{
		DatabaseURL:    strings.TrimSpace(os.Getenv("DATABASE_URL")),
		JWTSecret:      strings.TrimSpace(os.Getenv("JWT_SECRET")),
		Port:           strings.TrimSpace(os.Getenv("PORT")),
		FrontendOrigin: strings.TrimSpace(os.Getenv("FRONTEND_ORIGIN")),
		AIServiceURL:   strings.TrimSpace(os.Getenv("AI_SERVICE_URL")),
		UploadDir:      strings.TrimSpace(os.Getenv("UPLOAD_DIR")),
		AIModelVersion: strings.TrimSpace(os.Getenv("AI_MODEL_VERSION")),
	}
	if c.DatabaseURL == "" || c.JWTSecret == "" {
		return Config{}, errors.New("DATABASE_URL and JWT_SECRET are required")
	}
	if len(c.JWTSecret) < 32 {
		return Config{}, errors.New("JWT_SECRET must be at least 32 characters")
	}
	if c.Port == "" {
		c.Port = "8080"
	}
	if c.FrontendOrigin == "" {
		c.FrontendOrigin = "http://localhost:5173"
	}
	if c.AIServiceURL == "" {
		c.AIServiceURL = "http://127.0.0.1:8000"
	}
	if c.UploadDir == "" {
		c.UploadDir = "uploads"
	}
	if c.AIModelVersion == "" {
		c.AIModelVersion = "best_model.pth"
	}
	return c, nil
}
