// Inspect the message schema by default; apply migration 006 only with -apply.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/joho/godotenv"
)

func run(ctx context.Context, apply bool) error {
	_ = godotenv.Load()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		return errors.New("DATABASE_URL belum diatur; jalankan dari direktori backend dengan .env yang sesuai")
	}
	conn, err := pgx.Connect(ctx, url)
	if err != nil {
		// Connection errors may contain credentials; keep them out of terminal output.
		return errors.New("tidak dapat terhubung ke database yang dikonfigurasi")
	}
	defer conn.Close(context.Background())
	var table, edited, deleted bool
	err = conn.QueryRow(ctx, `SELECT to_regclass('messages') IS NOT NULL,
		EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('messages') AND attname='edited_at' AND NOT attisdropped),
		EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('messages') AND attname='deleted_at' AND NOT attisdropped)`).Scan(&table, &edited, &deleted)
	if err != nil {
		return errors.New("gagal memeriksa skema pesan")
	}
	fmt.Printf("Tabel messages: %t; edited_at: %t; deleted_at: %t\n", table, edited, deleted)
	if !table {
		return errors.New("tabel messages belum tersedia; terapkan migrasi 005 terlebih dahulu")
	}
	if edited && deleted {
		fmt.Println("Migrasi 006 sudah tersedia. Tidak ada perubahan database.")
		return nil
	}
	if edited || deleted {
		return errors.New("skema migrasi 006 tidak lengkap; periksa sebelum menerapkan migrasi")
	}
	if !apply {
		fmt.Println("Migrasi 006 belum diterapkan. Pemeriksaan ini tidak mengubah database.")
		fmt.Println("Setelah menyetujui target database, jalankan: go run ./cmd/migrate-messages -apply")
		return nil
	}
	sql, err := os.ReadFile("migrations/006_message_actions.sql")
	if err != nil {
		return errors.New("file migrasi 006 tidak dapat dibaca; jalankan dari direktori backend")
	}
	if _, err = conn.Exec(ctx, string(sql)); err != nil {
		return errors.New("migrasi 006 gagal; periksa status skema sebelum mencoba kembali")
	}
	fmt.Println("Migrasi 006 berhasil diterapkan. Muat ulang halaman konsultasi.")
	return nil
}

func main() {
	apply := flag.Bool("apply", false, "terapkan migrasi 006 ke DATABASE_URL yang dikonfigurasi")
	flag.Parse()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := run(ctx, *apply); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
