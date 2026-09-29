package services

import (
	"context"
	"errors"
	"strings"
	"time"

	"google.golang.org/api/idtoken"
)

var ErrGoogleNotConfigured = errors.New("google sign-in is not configured")
var ErrInvalidGoogleCredential = errors.New("invalid Google credential")
var ErrGoogleVerificationUnavailable = errors.New("Google token verification is unavailable")

type GoogleIdentity struct {
	Subject string
	Email   string
	Name    string
}

func (a *Auth) VerifyGoogle(ctx context.Context, credential string) (GoogleIdentity, error) {
	if a.GoogleClientID == "" {
		return GoogleIdentity{}, ErrGoogleNotConfigured
	}
	if credential == "" || len(credential) > 16<<10 {
		return GoogleIdentity{}, ErrInvalidGoogleCredential
	}
	verifyCtx, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()
	payload, err := idtoken.Validate(verifyCtx, credential, a.GoogleClientID)
	if errors.Is(err, context.DeadlineExceeded) || errors.Is(verifyCtx.Err(), context.DeadlineExceeded) {
		return GoogleIdentity{}, ErrGoogleVerificationUnavailable
	}
	if err != nil {
		return GoogleIdentity{}, ErrInvalidGoogleCredential
	}
	return googleIdentityFromPayload(payload, a.GoogleClientID)
}

func googleIdentityFromPayload(payload *idtoken.Payload, clientID string) (GoogleIdentity, error) {
	if payload == nil {
		return GoogleIdentity{}, ErrInvalidGoogleCredential
	}
	if payload.Issuer != "accounts.google.com" && payload.Issuer != "https://accounts.google.com" {
		return GoogleIdentity{}, ErrInvalidGoogleCredential
	}
	if payload.Audience != clientID || payload.Subject == "" || len(payload.Subject) > 255 {
		return GoogleIdentity{}, ErrInvalidGoogleCredential
	}
	email, ok := payload.Claims["email"].(string)
	if !ok || strings.TrimSpace(email) == "" || payload.Claims["email_verified"] != true {
		return GoogleIdentity{}, ErrInvalidGoogleCredential
	}
	name, _ := payload.Claims["name"].(string)
	return GoogleIdentity{Subject: payload.Subject, Email: strings.ToLower(strings.TrimSpace(email)), Name: strings.TrimSpace(name)}, nil
}
