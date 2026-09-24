package repositories

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("record not found")

type Store struct{ DB *pgxpool.Pool }

func New(db *pgxpool.Pool) *Store { return &Store{DB: db} }

func one(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	return err
}

func (s *Store) Health(ctx context.Context) error { return s.DB.Ping(ctx) }
