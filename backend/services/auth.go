package services

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type Claims struct {
	UserID int64  `json:"user_id"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

type Auth struct{ Secret []byte }

func NewAuth(secret string) *Auth { return &Auth{Secret: []byte(secret)} }

func (a *Auth) Hash(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(hash), err
}

func (a *Auth) Check(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

func (a *Auth) Token(userID int64, role string) (string, error) {
	now := time.Now()
	claims := Claims{UserID: userID, Role: role, RegisteredClaims: jwt.RegisteredClaims{IssuedAt: jwt.NewNumericDate(now), ExpiresAt: jwt.NewNumericDate(now.Add(24 * time.Hour)), Issuer: "footguard"}}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(a.Secret)
}

func (a *Auth) Parse(raw string) (*Claims, error) {
	claims := new(Claims)
	token, err := jwt.ParseWithClaims(raw, claims, func(t *jwt.Token) (any, error) {
		if t.Method.Alg() != jwt.SigningMethodHS256.Alg() {
			return nil, errors.New("unexpected JWT algorithm")
		}
		return a.Secret, nil
	}, jwt.WithIssuer("footguard"), jwt.WithExpirationRequired())
	if err != nil || !token.Valid || claims.UserID <= 0 {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}
