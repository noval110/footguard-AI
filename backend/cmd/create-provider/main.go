package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/mail"
	"os"
	"strings"

	"github.com/joho/godotenv"
	"github.com/noval110/footguard/backend/database"
	"github.com/noval110/footguard/backend/repositories"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	name := flag.String("name", "", "provider name")
	email := flag.String("email", "", "provider email")
	flag.Parse()
	_ = godotenv.Load()
	password := os.Getenv("PROVIDER_PASSWORD")
	if strings.TrimSpace(*name) == "" || len(*name) > 100 || strings.TrimSpace(*email) == "" || len(password) < 8 || len(password) > 72 {
		log.Fatal("name, email and PROVIDER_PASSWORD (8–72 characters) are required")
	}
	parsed, err := mail.ParseAddress(*email)
	if err != nil || parsed.Address != *email {
		log.Fatal("invalid email")
	}
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL is required")
	}
	ctx := context.Background()
	pool, err := database.Open(ctx, databaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatal(err)
	}
	user, err := repositories.New(pool).CreateProviderUser(ctx, strings.TrimSpace(*name), strings.ToLower(*email), string(hash))
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Created provider %s (id %d)\n", user.Email, user.ID)
}
