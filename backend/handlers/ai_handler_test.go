package handlers

import (
	"bytes"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
)

func pngImage(t *testing.T) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 2, 2))
	img.Set(0, 0, color.RGBA{R: 255, A: 255})
	var data bytes.Buffer
	if err := png.Encode(&data, img); err != nil {
		t.Fatal(err)
	}
	return data.Bytes()
}

func uploadRequest(t *testing.T, imageData []byte) *http.Request {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "foot.png")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := part.Write(imageData); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/examinations/analyze", &body)
	req.Header.Set(echo.HeaderContentType, writer.FormDataContentType())
	return req
}

func TestAnalyzeFootImageForwardsImageAndReturnsResult(t *testing.T) {
	input := pngImage(t)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/analyze" || r.Method != http.MethodPost {
			t.Errorf("unexpected upstream request: %s %s", r.Method, r.URL.Path)
		}
		file, header, err := r.FormFile("file")
		if err != nil {
			t.Errorf("upstream multipart file: %v", err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		defer file.Close()
		got, err := io.ReadAll(file)
		if err != nil || !bytes.Equal(got, input) || header.Header.Get("Content-Type") != "image/png" {
			t.Errorf("upstream file content or type changed: %v, %s", err, header.Header.Get("Content-Type"))
		}
		w.Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		_, _ = io.WriteString(w, `{"status":"success","result":{"ulcer_detected":true,"ulcer_area_percent":1.25,"confidence":0.9,"threshold":0.5,"overlay_image":"data:image/jpeg;base64,AAAA"}}`)
	}))
	defer upstream.Close()

	h := New(nil, nil, upstream.URL)
	recorder := httptest.NewRecorder()
	c := echo.New().NewContext(uploadRequest(t, input), recorder)
	if err := h.AnalyzeFootImage(c); err != nil {
		t.Fatal(err)
	}
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", recorder.Code, recorder.Body.String())
	}
	var result AIResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &result); err != nil || result.Status != "success" || result.Result.Confidence != 0.9 {
		t.Fatalf("unexpected response: %+v, %v", result, err)
	}
}

func TestAnalyzeFootImageRejectsInvalidFileAndMapsAIUnavailable(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer upstream.Close()
	h := New(nil, nil, upstream.URL)

	for _, tc := range []struct {
		name string
		data []byte
		want int
	}{
		{"invalid image", []byte("not an image"), http.StatusBadRequest},
		{"valid image but unavailable model", pngImage(t), http.StatusServiceUnavailable},
	} {
		t.Run(tc.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			c := echo.New().NewContext(uploadRequest(t, tc.data), recorder)
			if err := h.AnalyzeFootImage(c); err != nil {
				t.Fatal(err)
			}
			if recorder.Code != tc.want {
				t.Fatalf("expected %d, got %d: %s", tc.want, recorder.Code, recorder.Body.String())
			}
		})
	}
}
