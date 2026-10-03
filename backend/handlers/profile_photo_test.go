package handlers

import (
	"bytes"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"mime/multipart"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/noval110/footguard/backend/models"
)

func profilePNG(t *testing.T, shade color.Color) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 8, 8))
	img.Set(0, 0, shade)
	var data bytes.Buffer
	if err := png.Encode(&data, img); err != nil {
		t.Fatal(err)
	}
	return data.Bytes()
}

func profileRequest(t *testing.T, userID int64, method, path string, photo []byte, action echo.HandlerFunc) *httptest.ResponseRecorder {
	t.Helper()
	var body bytes.Buffer
	contentType := ""
	if photo != nil {
		writer := multipart.NewWriter(&body)
		part, err := writer.CreateFormFile("photo", "photo.png")
		if err != nil {
			t.Fatal(err)
		}
		if _, err := part.Write(photo); err != nil {
			t.Fatal(err)
		}
		contentType = writer.FormDataContentType()
		if err := writer.Close(); err != nil {
			t.Fatal(err)
		}
	}
	req := httptest.NewRequest(method, path, &body)
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	res := httptest.NewRecorder()
	c := echo.New().NewContext(req, res)
	c.Set("auth_user", models.User{ID: userID, Name: "Test Patient", Role: "patient"})
	if err := action(c); err != nil {
		t.Fatal(err)
	}
	return res
}

func profileResponseUser(t *testing.T, res *httptest.ResponseRecorder) models.User {
	t.Helper()
	if res.Code != 200 {
		t.Fatalf("got %d: %s", res.Code, res.Body.String())
	}
	var response struct {
		Data models.User `json:"data"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	return response.Data
}

func TestProfilePhotoLifecycleAndOwnerIsolation(t *testing.T) {
	h := &Handler{UploadDir: t.TempDir()}
	photo := profilePNG(t, color.RGBA{R: 200, A: 255})
	first := profileResponseUser(t, profileRequest(t, 1, "PUT", "/api/profile/photo", photo, h.UpdateProfilePhoto))
	if first.AvatarURL == "" {
		t.Fatal("upload must return photo URL")
	}
	restarted := &Handler{UploadDir: h.UploadDir}
	profile := profileResponseUser(t, profileRequest(t, 1, "GET", "/api/profile", nil, restarted.Profile))
	if profile.AvatarURL != first.AvatarURL {
		t.Fatal("photo must survive backend restart")
	}
	res := profileRequest(t, 1, "GET", first.AvatarURL, nil, restarted.ProfilePhoto)
	if res.Code != 200 || res.Header().Get("Cache-Control") != "private, no-store" {
		t.Fatal("photo response must be private")
	}
	if _, format, err := image.Decode(bytes.NewReader(res.Body.Bytes())); err != nil || format != "jpeg" {
		t.Fatalf("invalid normalized image: %s, %v", format, err)
	}
	if profileRequest(t, 2, "GET", first.AvatarURL, nil, h.ProfilePhoto).Code != 404 {
		t.Fatal("query parameter must not grant access to another user's photo")
	}
	profileResponseUser(t, profileRequest(t, 2, "DELETE", first.AvatarURL, nil, h.DeleteProfilePhoto))
	if profileRequest(t, 1, "GET", first.AvatarURL, nil, h.ProfilePhoto).Code != 200 {
		t.Fatal("other user must not delete owner's photo")
	}
	replacement := profileResponseUser(t, profileRequest(t, 1, "PUT", "/api/profile/photo", profilePNG(t, color.Black), h.UpdateProfilePhoto))
	if replacement.AvatarURL == first.AvatarURL {
		t.Fatal("replacement must change photo version")
	}
	removed := profileResponseUser(t, profileRequest(t, 1, "DELETE", "/api/profile/photo", nil, h.DeleteProfilePhoto))
	if removed.AvatarURL != "" {
		t.Fatal("deleted photo URL must be empty")
	}
	if profileRequest(t, 1, "GET", "/api/profile/photo", nil, h.ProfilePhoto).Code != 404 {
		t.Fatal("deleted photo must no longer be served")
	}
	profileResponseUser(t, profileRequest(t, 1, "DELETE", "/api/profile/photo", nil, h.DeleteProfilePhoto))
}

func TestProfilePhotoInvalidUploadsPreserveExistingPhoto(t *testing.T) {
	h := &Handler{UploadDir: t.TempDir()}
	good := profilePNG(t, color.Black)
	profileResponseUser(t, profileRequest(t, 1, "PUT", "/api/profile/photo", good, h.UpdateProfilePhoto))
	before := profileRequest(t, 1, "GET", "/api/profile/photo", nil, h.ProfilePhoto).Body.Bytes()
	for _, test := range []struct {
		name   string
		data   []byte
		status int
	}{
		{"script", []byte(`<svg><script>alert(1)</script></svg>`), 400},
		{"corrupt image", good[:len(good)/2], 400},
		{"empty image", []byte{}, 400},
		{"oversized image", bytes.Repeat([]byte{0}, maxProfilePhotoBytes+1), 413},
	} {
		t.Run(test.name, func(t *testing.T) {
			res := profileRequest(t, 1, "PUT", "/api/profile/photo", test.data, h.UpdateProfilePhoto)
			if res.Code != test.status {
				t.Fatalf("got %d: %s", res.Code, res.Body.String())
			}
			after := profileRequest(t, 1, "GET", "/api/profile/photo", nil, h.ProfilePhoto).Body.Bytes()
			if !bytes.Equal(before, after) {
				t.Fatal("invalid upload replaced the existing photo")
			}
		})
	}
	if profileRequest(t, 1, "PUT", "/api/profile/photo", nil, h.UpdateProfilePhoto).Code != 400 {
		t.Fatal("missing multipart upload must be rejected")
	}
	large := image.NewRGBA(image.Rect(0, 0, 4097, 1))
	var data bytes.Buffer
	if err := png.Encode(&data, large); err != nil {
		t.Fatal(err)
	}
	if _, err := normalizeProfilePhoto(data.Bytes()); err == nil {
		t.Fatal("excessive dimensions accepted")
	}
	encoded, err := normalizeProfilePhoto(append(good, []byte("private metadata")...))
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(encoded, []byte("private metadata")) {
		t.Fatal("metadata was retained")
	}
}
