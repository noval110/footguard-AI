package handlers

import (
	"github.com/labstack/echo/v4"
	appmiddleware "github.com/noval110/footguard/backend/middleware"
	"net/http"
	"strconv"
)

func (h *Handler) Progress(c echo.Context) error {
	patientID := int64(0)
	if appmiddleware.User(c).Role == "patient" {
		p, err := h.patient(c)
		if err != nil {
			return dbError(c, err)
		}
		patientID = p.ID
	} else {
		id, err := idParam(c)
		if err != nil {
			return fail(c, 400, "ID pasien tidak valid.")
		}
		patientID = id
		if _, err = h.Store.PatientByID(c.Request().Context(), patientID); err != nil {
			return dbError(c, err)
		}
	}
	result, err := h.Store.Progress(c.Request().Context(), patientID)
	if err != nil {
		return dbError(c, err)
	}
	return success(c, http.StatusOK, result)
}
func (h *Handler) Comparison(c echo.Context) error {
	e, err := h.authorizedExam(c)
	if err != nil {
		return examError(c, err)
	}
	current, err := h.Store.ExamDetail(c.Request().Context(), e.ID)
	if err != nil {
		return dbError(c, err)
	}
	previous, err := h.Store.PreviousExam(c.Request().Context(), e)
	if err != nil {
		return dbError(c, err)
	}
	return success(c, 200, map[string]any{"current": current, "previous": previous})
}
func (h *Handler) ReviewQueue(c echo.Context) error {
	offset := int64(0)
	var err error
	if value := c.QueryParam("offset"); value != "" {
		offset, err = strconv.ParseInt(value, 10, 64)
		if err != nil || offset < 0 || offset > 100000 {
			return fail(c, 400, "Halaman antrean tidak valid.")
		}
	}
	result, err := h.Store.ReviewQueue(c.Request().Context(), offset)
	if err != nil {
		return dbError(c, err)
	}
	return success(c, 200, result)
}
