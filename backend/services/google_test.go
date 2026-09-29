package services

import (
	"context"
	"errors"
	"testing"

	"google.golang.org/api/idtoken"
)

func TestGoogleVerifiedClaims(t *testing.T) {
	valid := &idtoken.Payload{
		Issuer:   "https://accounts.google.com",
		Audience: "web-client-id",
		Subject:  "stable-google-sub",
		Claims: map[string]interface{}{
			"email":          "Patient@Example.com",
			"email_verified": true,
			"name":           "Patient Name",
		},
	}
	identity, err := googleIdentityFromPayload(valid, "web-client-id")
	if err != nil || identity.Subject != "stable-google-sub" || identity.Email != "patient@example.com" || identity.Name != "Patient Name" {
		t.Fatalf("valid verified claims rejected: %+v, %v", identity, err)
	}
	for _, change := range []struct {
		name string
		edit func(*idtoken.Payload)
	}{
		{"wrong audience", func(p *idtoken.Payload) { p.Audience = "other-client" }},
		{"wrong issuer", func(p *idtoken.Payload) { p.Issuer = "https://attacker.example" }},
		{"missing subject", func(p *idtoken.Payload) { p.Subject = "" }},
		{"unverified email", func(p *idtoken.Payload) { p.Claims["email_verified"] = false }},
		{"missing email", func(p *idtoken.Payload) { delete(p.Claims, "email") }},
	} {
		t.Run(change.name, func(t *testing.T) {
			copy := *valid
			copy.Claims = map[string]interface{}{}
			for key, value := range valid.Claims {
				copy.Claims[key] = value
			}
			change.edit(&copy)
			if _, err := googleIdentityFromPayload(&copy, "web-client-id"); !errors.Is(err, ErrInvalidGoogleCredential) {
				t.Fatalf("invalid claims accepted: %v", err)
			}
		})
	}
	if _, err := NewAuth("test-secret").VerifyGoogle(context.Background(), "invalid"); !errors.Is(err, ErrGoogleNotConfigured) {
		t.Fatalf("missing client ID accepted: %v", err)
	}
}
