package handlers

import (
	"bytes"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/labstack/echo/v4"
	appmiddleware "github.com/noval110/footguard/backend/middleware"
	"github.com/noval110/footguard/backend/repositories"
)

var storedFileName = regexp.MustCompile(`^[a-f0-9]{32}\.(jpg|png|webp)$`)

func saveImage(dir, extension string, data []byte) (string, error) {
	if err := os.MkdirAll(dir, 0700); err != nil {
		return "", err
	}

	random := make([]byte, 16)
	if _, err := rand.Read(random); err != nil {
		return "", err
	}

	name := hex.EncodeToString(random) + extension
	path := filepath.Join(dir, name)

	file, err := os.OpenFile(
		path,
		os.O_WRONLY|os.O_CREATE|os.O_EXCL,
		0600,
	)
	if err != nil {
		return "", err
	}

	_, writeErr := file.Write(data)
	closeErr := file.Close()

	if writeErr != nil {
		os.Remove(path)
		return "", writeErr
	}

	if closeErr != nil {
		os.Remove(path)
		return "", closeErr
	}

	return path, nil
}

func (h *Handler) persistAnalysis(
	c echo.Context,
	examID,
	patientID int64,
	side string,
	original []byte,
	contentType string,
	result AIResponse,
) error {
	r := result.Result

	// Validate classifier confidence.
	if math.IsNaN(r.ClassificationConfidence) ||
		math.IsInf(r.ClassificationConfidence, 0) ||
		r.ClassificationConfidence < 0 ||
		r.ClassificationConfidence > 1 {
		return fail(
			c,
			http.StatusBadGateway,
			"Confidence klasifikasi AI tidak valid",
		)
	}

	// Validate segmentation values.
	if math.IsNaN(r.UlcerAreaPercent) ||
		math.IsInf(r.UlcerAreaPercent, 0) ||
		r.UlcerAreaPercent < 0 ||
		r.UlcerAreaPercent > 100 ||
		math.IsNaN(r.SegmentationConfidence) ||
		math.IsInf(r.SegmentationConfidence, 0) ||
		r.SegmentationConfidence < 0 ||
		r.SegmentationConfidence > 1 ||
		math.IsNaN(r.Threshold) ||
		math.IsInf(r.Threshold, 0) ||
		r.Threshold < 0 ||
		r.Threshold > 1 {
		return fail(
			c,
			http.StatusBadGateway,
			"Angka hasil AI tidak valid",
		)
	}

	// Only accept the two classifier outputs.
	finding := strings.TrimSpace(r.Classification)

	if finding != "Normal" && finding != "Wound" {
		return fail(
			c,
			http.StatusBadGateway,
			"Hasil klasifikasi AI tidak valid",
		)
	}

	// Decode overlay returned by the AI service.
	encoded := strings.TrimPrefix(
		r.OverlayImage,
		"data:image/jpeg;base64,",
	)

	overlay, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil ||
		len(overlay) == 0 ||
		len(overlay) > maxAIResponseSize ||
		http.DetectContentType(overlay) != "image/jpeg" {
		return fail(
			c,
			http.StatusBadGateway,
			"Gambar overlay AI tidak valid",
		)
	}

	if _, _, err := image.DecodeConfig(
		bytes.NewReader(overlay),
	); err != nil {
		return fail(
			c,
			http.StatusBadGateway,
			"Gambar overlay AI tidak dapat dibaca",
		)
	}

	// Determine original image extension.
	extension := ".jpg"

	if contentType == "image/png" {
		extension = ".png"
	}

	if contentType == "image/webp" {
		extension = ".webp"
	}

	// Save original image.
	originalPath, err := saveImage(
		filepath.Join(
			h.UploadDir,
			"original",
		),
		extension,
		original,
	)
	if err != nil {
		return fail(
			c,
			http.StatusInternalServerError,
			"Gagal menyimpan foto asli",
		)
	}

	// Save AI overlay.
	overlayPath, err := saveImage(
		filepath.Join(
			h.UploadDir,
			"overlay",
		),
		".jpg",
		overlay,
	)
	if err != nil {
		os.Remove(originalPath)

		return fail(
			c,
			http.StatusInternalServerError,
			"Gagal menyimpan overlay AI",
		)
	}

	originalURL := "/api/uploads/original/" +
		filepath.Base(originalPath)

	overlayURL := "/api/uploads/overlay/" +
		filepath.Base(overlayPath)

	// Use classifier confidence as the primary confidence
	// stored in the existing AI result schema.
	classificationConfidence := float32(
		r.ClassificationConfidence,
	)

	exam, img, ai, err := h.Store.SaveVisualAnalysis(
		c.Request().Context(),
		patientID,
		examID,
		originalURL,
		side,
		overlayURL,
		h.AIModelVersion,
		finding,
		r.UlcerDetected,
		float32(r.UlcerAreaPercent),
		classificationConfidence,
		float32(r.Threshold),
	)
	if err != nil {
		os.Remove(originalPath)
		os.Remove(overlayPath)

		if errors.Is(err, repositories.ErrExamClosed) {
			return fail(
				c,
				http.StatusConflict,
				"Pemeriksaan sudah ditinjau",
			)
		}

		return dbError(c, err)
	}

	return success(
		c,
		http.StatusCreated,
		map[string]any{
			"examination": exam,
			"image":       img,
			"ai_result":   ai,
		},
	)
}

func (h *Handler) ServeUploadedImage(c echo.Context) error {
	kind, name := c.Param("kind"), c.Param("name")

	if !validChoice(kind, "original", "overlay") ||
		!storedFileName.MatchString(name) {
		return fail(
			c,
			http.StatusNotFound,
			"Gambar tidak ditemukan",
		)
	}

	url := "/api/uploads/" + kind + "/" + name

	owner, err := h.Store.StoredImageOwner(
		c.Request().Context(),
		kind,
		url,
	)
	if err != nil {
		return dbError(c, err)
	}

	user := appmiddleware.User(c)

	if user.Role != "provider" &&
		(user.Role != "patient" || user.ID != owner) {
		return fail(
			c,
			http.StatusNotFound,
			"Gambar tidak ditemukan",
		)
	}

	c.Response().Header().Set(
		"Cache-Control",
		"private, no-store",
	)

	c.Response().Header().Set(
		"X-Content-Type-Options",
		"nosniff",
	)

	path := filepath.Join(
		h.UploadDir,
		kind,
		name,
	)

	if _, err := os.Stat(path); err != nil {
		return fail(
			c,
			http.StatusNotFound,
			"Gambar tidak ditemukan",
		)
	}

	return c.File(path)
}
