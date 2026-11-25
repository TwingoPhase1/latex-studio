package server_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"

	"latex-studio/internal/server"
)

func newTestServer(t *testing.T) http.Handler {
	t.Helper()
	mockWeb := fstest.MapFS{
		"index.html":                 {Data: []byte("<!doctype html><html><body>LaTeX Studio PWA</body></html>")},
		"sw.js":                      {Data: []byte("self.addEventListener('install', () => {});")},
		"manifest.webmanifest":       {Data: []byte(`{"name":"LaTeX Studio"}`)},
		"icon.svg":                   {Data: []byte(`<svg xmlns="http://www.w3.org/2000/svg"></svg>`)},
		"static/app.css":             {Data: []byte("body { margin: 0; }")},
		"static/vendor/mathjax.js":   {Data: []byte("window.MathJax = {};")},
	}
	return server.New(mockWeb)
}

func TestHealthAndStaticPWA(t *testing.T) {
	h := newTestServer(t)

	// Health
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"mode":"offline-pwa"`) {
		t.Fatalf("unexpected /api/health response: code=%d body=%s", rec.Code, rec.Body.String())
	}

	// Unknown /api/ returns JSON 404
	req = httptest.NewRequest(http.MethodGet, "/api/unknown", nil)
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound || !strings.Contains(rec.Header().Get("Content-Type"), "application/json") {
		t.Fatalf("expected JSON 404 on /api/unknown, got code=%d ct=%s", rec.Code, rec.Header().Get("Content-Type"))
	}

	// Root HTML
	req = httptest.NewRequest(http.MethodGet, "/", nil)
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "LaTeX Studio PWA") {
		t.Fatalf("unexpected / response: code=%d body=%s", rec.Code, rec.Body.String())
	}

	// Service Worker
	req = httptest.NewRequest(http.MethodGet, "/sw.js", nil)
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || rec.Header().Get("Service-Worker-Allowed") != "/" || rec.Header().Get("Cache-Control") != "no-cache" {
		t.Fatalf("unexpected /sw.js headers: code=%d headers=%v", rec.Code, rec.Header())
	}

	// Manifest
	req = httptest.NewRequest(http.MethodGet, "/manifest.webmanifest", nil)
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Header().Get("Content-Type"), "application/manifest+json") {
		t.Fatalf("unexpected /manifest.webmanifest response: code=%d ct=%s", rec.Code, rec.Header().Get("Content-Type"))
	}

	// Icon SVG
	req = httptest.NewRequest(http.MethodGet, "/icon.svg", nil)
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Header().Get("Cache-Control"), "max-age=86400") {
		t.Fatalf("unexpected /icon.svg response: code=%d cc=%s", rec.Code, rec.Header().Get("Cache-Control"))
	}

	// Vendor immutable cache header
	req = httptest.NewRequest(http.MethodGet, "/static/vendor/mathjax.js", nil)
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Header().Get("Cache-Control"), "immutable") {
		t.Fatalf("expected immutable cache on /static/vendor/, got code=%d cc=%s", rec.Code, rec.Header().Get("Cache-Control"))
	}
}
