package services

import (
	"testing"
)

func TestPasswordAndToken(t *testing.T) {
	auth := NewAuth("a-test-secret-with-at-least-32-characters")
	hash, err := auth.Hash("ExamplePass123!")
	if err != nil {
		t.Fatal(err)
	}
	if hash == "ExamplePass123!" || !auth.Check(hash, "ExamplePass123!") || auth.Check(hash, "wrong-password") {
		t.Fatal("bcrypt password verification failed")
	}
	token, err := auth.Token(42, "patient")
	if err != nil {
		t.Fatal(err)
	}
	claims, err := auth.Parse(token)
	if err != nil || claims.UserID != 42 || claims.Role != "patient" {
		t.Fatalf("unexpected claims: %+v, %v", claims, err)
	}
	if _, err := NewAuth("another-test-secret-with-at-least-32-characters").Parse(token); err == nil {
		t.Fatal("token accepted with a different secret")
	}
}
