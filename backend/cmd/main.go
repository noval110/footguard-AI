package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/noval110/footguard/backend/config"
	"github.com/noval110/footguard/backend/database"
	"github.com/noval110/footguard/backend/repositories"
	"github.com/noval110/footguard/backend/routes"
	"github.com/noval110/footguard/backend/services"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	pool, err := database.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()
	e := routes.New(repositories.New(pool), services.NewAuth(cfg.JWTSecret), cfg.FrontendOrigin, cfg.AIServiceURL, cfg.UploadDir, cfg.AIModelVersion)
	server := &http.Server{Addr: ":" + cfg.Port, Handler: e, ReadHeaderTimeout: 10 * time.Second, ReadTimeout: 20 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second}
	go func() {
		log.Printf("FootGuard API listening on :%s", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("server failed: %v", err)
			stop()
		}
	}()
	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("shutdown error: %v", err)
	}
}
