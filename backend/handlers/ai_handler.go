package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"strings"

	"github.com/labstack/echo/v4"
)

const maxAIImageSize = 10 << 20
const maxAIResponseSize = 16 << 20

type AIResponse struct {
	Status string `json:"status"`
	Result struct {
		Classification           string  `json:"classification"`
		ClassificationConfidence float64 `json:"classification_confidence"`

		UlcerDetected          bool    `json:"ulcer_detected"`
		UlcerAreaPercent       float64 `json:"ulcer_area_percent"`
		Confidence             float64 `json:"confidence"`
		SegmentationConfidence float64 `json:"segmentation_confidence"`
		Threshold              float64 `json:"threshold"`
		SegmentationApplied    bool    `json:"segmentation_applied"`

		OverlayImage string `json:"overlay_image"`
	} `json:"result"`
}

// AnalyzeFootImage forwards one patient-uploaded image to the local AI service.
// It returns visual analysis only; it does not create an examination or clinical risk record.
func (h *Handler) AnalyzeFootImage(c echo.Context) error {
	return h.analyzeFootImage(c, false)
}

func (h *Handler) AnalyzeAndPersistFootImage(c echo.Context) error {
	return h.analyzeFootImage(c, true)
}

func (h *Handler) analyzeFootImage(c echo.Context, persist bool) error {
	var examID, patientID int64
	var side string

	if persist {
		exam, err := h.authorizedExam(c)
		if err != nil {
			return examError(c, err)
		}

		if exam.Status == "reviewed" {
			return fail(c, http.StatusConflict, "Pemeriksaan sudah ditinjau")
		}

		examID = exam.ID
		patientID = exam.PatientID
	}

	c.Request().Body = http.MaxBytesReader(
		c.Response(),
		c.Request().Body,
		maxAIImageSize+(1<<20),
	)

	file, err := c.FormFile("file")
	if err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			return fail(
				c,
				http.StatusRequestEntityTooLarge,
				"Gambar terlalu besar",
			)
		}

		return fail(
			c,
			http.StatusBadRequest,
			"File gambar wajib diunggah",
		)
	}

	if file.Size > maxAIImageSize {
		return fail(
			c,
			http.StatusRequestEntityTooLarge,
			"Gambar terlalu besar",
		)
	}

	if persist {
		side = c.FormValue("foot_side")

		if !validChoice(side, "left", "right") {
			return fail(
				c,
				http.StatusBadRequest,
				"Pilih sisi kaki kiri atau kanan",
			)
		}
	}

	src, err := file.Open()
	if err != nil {
		return fail(
			c,
			http.StatusBadRequest,
			"Gagal membuka gambar",
		)
	}

	defer src.Close()

	image, err := io.ReadAll(
		io.LimitReader(
			src,
			maxAIImageSize+1,
		),
	)
	if err != nil {
		return fail(
			c,
			http.StatusBadRequest,
			"Gagal membaca gambar",
		)
	}

	if len(image) > maxAIImageSize {
		return fail(
			c,
			http.StatusRequestEntityTooLarge,
			"Gambar terlalu besar",
		)
	}

	contentType := http.DetectContentType(image)

	if contentType != "image/jpeg" &&
		contentType != "image/png" &&
		contentType != "image/webp" {
		return fail(
			c,
			http.StatusBadRequest,
			"File harus berupa gambar JPEG, PNG, atau WebP",
		)
	}

	var body bytes.Buffer

	writer := multipart.NewWriter(&body)

	header := make(textproto.MIMEHeader)

	header.Set(
		"Content-Disposition",
		mime.FormatMediaType(
			"form-data",
			map[string]string{
				"name":     "file",
				"filename": file.Filename,
			},
		),
	)

	header.Set("Content-Type", contentType)

	part, err := writer.CreatePart(header)
	if err != nil {
		return fail(
			c,
			http.StatusInternalServerError,
			"Gagal membuat request AI",
		)
	}

	if _, err := part.Write(image); err != nil {
		return fail(
			c,
			http.StatusInternalServerError,
			"Gagal menyiapkan gambar",
		)
	}

	if err := writer.Close(); err != nil {
		return fail(
			c,
			http.StatusInternalServerError,
			"Gagal menyelesaikan request AI",
		)
	}

	req, err := http.NewRequestWithContext(
		c.Request().Context(),
		http.MethodPost,
		h.AIServiceURL+"/analyze",
		&body,
	)
	if err != nil {
		return fail(
			c,
			http.StatusBadGateway,
			"Konfigurasi AI service tidak valid",
		)
	}

	req.Header.Set(
		echo.HeaderContentType,
		writer.FormDataContentType(),
	)

	resp, err := h.AIClient.Do(req)
	if err != nil {
		return fail(
			c,
			http.StatusBadGateway,
			"AI service tidak dapat dihubungi",
		)
	}

	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		if resp.StatusCode == http.StatusServiceUnavailable {
			return fail(
				c,
				http.StatusServiceUnavailable,
				"Model AI belum tersedia",
			)
		}

		if resp.StatusCode == http.StatusBadRequest ||
			resp.StatusCode == http.StatusUnprocessableEntity ||
			resp.StatusCode == http.StatusUnsupportedMediaType {
			return fail(
				c,
				http.StatusBadRequest,
				"Gambar tidak dapat dianalisis",
			)
		}

		return fail(
			c,
			http.StatusBadGateway,
			"AI service gagal memproses gambar",
		)
	}

	responseBody, err := io.ReadAll(
		io.LimitReader(
			resp.Body,
			maxAIResponseSize+1,
		),
	)
	if err != nil || len(responseBody) > maxAIResponseSize {
		return fail(
			c,
			http.StatusBadGateway,
			"Respons AI terlalu besar atau tidak terbaca",
		)
	}

	var aiResponse AIResponse

	if err := json.Unmarshal(
		responseBody,
		&aiResponse,
	); err != nil ||
		aiResponse.Status != "success" ||
		!strings.HasPrefix(
			aiResponse.Result.OverlayImage,
			"data:image/jpeg;base64,",
		) {
		return fail(
			c,
			http.StatusBadGateway,
			"Respons AI tidak valid",
		)
	}

	if persist {
		return h.persistAnalysis(
			c,
			examID,
			patientID,
			side,
			image,
			contentType,
			aiResponse,
		)
	}

	return c.JSON(
		http.StatusOK,
		aiResponse,
	)
}
