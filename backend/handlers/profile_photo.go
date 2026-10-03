package handlers

import (
	"bytes"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"github.com/labstack/echo/v4"
	appmiddleware "github.com/noval110/footguard/backend/middleware"
)

const maxProfilePhotoBytes = 5 << 20

func (h *Handler) profilePhotoPath(userID int64) string {
	return filepath.Join(h.UploadDir, "avatars", strconv.FormatInt(userID, 10)+".jpg")
}

func (h *Handler) profilePhotoURL(userID int64) (string, error) {
	info, err := os.Stat(h.profilePhotoPath(userID))
	if errors.Is(err, os.ErrNotExist) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("/api/profile/photo?user=%d&v=%d", userID, info.ModTime().UnixNano()), nil
}

// The owner always comes from the authenticated session, never a URL parameter.
func (h *Handler) ProfilePhoto(c echo.Context) error {
	file, err := os.Open(h.profilePhotoPath(appmiddleware.User(c).ID))
	if errors.Is(err, os.ErrNotExist) {
		return fail(c, http.StatusNotFound, "Foto profil belum tersedia.")
	}
	if err != nil {
		return dbError(c, err)
	}
	defer file.Close()
	c.Response().Header().Set("Cache-Control", "private, no-store")
	c.Response().Header().Set("X-Content-Type-Options", "nosniff")
	return c.Stream(http.StatusOK, "image/jpeg", file)
}

func (h *Handler) UpdateProfilePhoto(c echo.Context) error {
	req := c.Request()
	req.Body = http.MaxBytesReader(c.Response(), req.Body, maxProfilePhotoBytes+(64<<10))
	if err := req.ParseMultipartForm(maxProfilePhotoBytes + (64 << 10)); err != nil {
		var limit *http.MaxBytesError
		if errors.As(err, &limit) {
			return fail(c, http.StatusRequestEntityTooLarge, "Ukuran foto maksimal 5 MB.")
		}
		return fail(c, http.StatusBadRequest, "Pilih foto JPG atau PNG yang valid.")
	}
	defer req.MultipartForm.RemoveAll()
	file, _, err := req.FormFile("photo")
	if err != nil {
		return fail(c, http.StatusBadRequest, "Pilih foto profil terlebih dahulu.")
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, maxProfilePhotoBytes+1))
	if err != nil {
		return fail(c, http.StatusBadRequest, "Foto tidak dapat dibaca.")
	}
	if len(data) > maxProfilePhotoBytes {
		return fail(c, http.StatusRequestEntityTooLarge, "Ukuran foto maksimal 5 MB.")
	}
	normalized, err := normalizeProfilePhoto(data)
	if err != nil {
		return fail(c, http.StatusBadRequest, err.Error())
	}
	user := appmiddleware.User(c)
	target := h.profilePhotoPath(user.ID)
	// Write completely before replacing the previous photo, including on Windows.
	temporary, err := saveImage(filepath.Dir(target), ".jpg", normalized)
	if err != nil {
		return dbError(c, err)
	}
	defer os.Remove(temporary)
	if err := os.Rename(temporary, target); err != nil {
		return dbError(c, err)
	}
	return h.Profile(c)
}

func (h *Handler) DeleteProfilePhoto(c echo.Context) error {
	err := os.Remove(h.profilePhotoPath(appmiddleware.User(c).ID))
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return dbError(c, err)
	}
	return h.Profile(c)
}

func normalizeProfilePhoto(data []byte) ([]byte, error) {
	config, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || (format != "jpeg" && format != "png") {
		return nil, errors.New("Gunakan foto JPG atau PNG yang valid.")
	}
	if config.Width <= 0 || config.Height <= 0 || config.Width > 4096 || config.Height > 4096 {
		return nil, errors.New("Dimensi foto maksimal 4096 × 4096 piksel.")
	}
	decoded, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, errors.New("Foto rusak atau tidak dapat dibaca.")
	}
	// Flatten transparency and strip metadata by encoding pixels as a new JPEG.
	background := image.NewRGBA(decoded.Bounds())
	draw.Draw(background, background.Bounds(), &image.Uniform{C: color.White}, image.Point{}, draw.Src)
	draw.Draw(background, background.Bounds(), decoded, decoded.Bounds().Min, draw.Over)
	var output bytes.Buffer
	if err := jpeg.Encode(&output, background, &jpeg.Options{Quality: 85}); err != nil {
		return nil, errors.New("Foto tidak dapat diproses.")
	}
	if output.Len() > maxProfilePhotoBytes {
		return nil, errors.New("Foto terlalu besar. Pilih foto dengan resolusi lebih kecil.")
	}
	return output.Bytes(), nil
}
