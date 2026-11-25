package server_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"

	"latex-studio/internal/server"
	"latex-studio/internal/store"
)

func newTestServer(t *testing.T) http.Handler {
	t.Helper()
	st, err := store.New(t.TempDir())
	if err != nil {
		t.Fatalf("store.New failed: %v", err)
	}
	mockWeb := fstest.MapFS{
		"index.html":     {Data: []byte("<!doctype html><html><body>LaTeX Studio Go</body></html>")},
		"static/app.css": {Data: []byte("body { margin: 0; }")},
		"static/app.js":  {Data: []byte("console.log('ok');")},
	}
	return server.New(st, mockWeb)
}

func TestHealthAndIndex(t *testing.T) {
	h := newTestServer(t)

	// Health
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 on /api/health, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), `"engine":"go"`) {
		t.Fatalf("unexpected health body: %s", rec.Body.String())
	}

	// Root index
	req = httptest.NewRequest(http.MethodGet, "/", nil)
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "LaTeX Studio Go") {
		t.Fatalf("unexpected index response: code=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestSymbolsAndTemplates(t *testing.T) {
	h := newTestServer(t)

	// All symbols
	req := httptest.NewRequest(http.MethodGet, "/api/symbols", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 on /api/symbols, got %d", rec.Code)
	}
	var symResp struct {
		Categories []any `json:"categories"`
		Symbols    []any `json:"symbols"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &symResp); err != nil {
		t.Fatalf("unmarshal symbols: %v", err)
	}
	if len(symResp.Categories) != 9 || len(symResp.Symbols) < 200 {
		t.Fatalf("expected 9 categories and 200+ symbols, got %d categories, %d symbols", len(symResp.Categories), len(symResp.Symbols))
	}

	// Filtered symbols ?q=alpha
	req = httptest.NewRequest(http.MethodGet, "/api/symbols?q=alpha", nil)
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `\alpha`) {
		t.Fatalf("expected alpha in search result, got %s", rec.Body.String())
	}

	// Templates
	req = httptest.NewRequest(http.MethodGet, "/api/templates", nil)
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 on /api/templates, got %d", rec.Code)
	}
	var tplResp struct {
		Templates []any `json:"templates"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &tplResp); err != nil {
		t.Fatalf("unmarshal templates: %v", err)
	}
	if len(tplResp.Templates) != 13 {
		t.Fatalf("expected 13 templates, got %d", len(tplResp.Templates))
	}
}

func TestSnippetsCRUDAndShare(t *testing.T) {
	h := newTestServer(t)

	// Create snippet
	body := bytes.NewBufferString(`{"title":"Gauss","latex":"\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/snippets", body)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201 creating snippet, got %d: %s", rec.Code, rec.Body.String())
	}
	var created store.SavedEquation
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		t.Fatalf("unmarshal created snippet: %v", err)
	}
	if created.ID == "" || created.Title != "Gauss" {
		t.Fatalf("unexpected created snippet: %+v", created)
	}

	// Patch snippet
	patchBody := bytes.NewBufferString(`{"title":"Intégrale de Gauss","pinned":true}`)
	req = httptest.NewRequest(http.MethodPatch, "/api/snippets/"+created.ID, patchBody)
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"pinned":true`) {
		t.Fatalf("expected patched snippet, got %d: %s", rec.Code, rec.Body.String())
	}

	// List snippets
	req = httptest.NewRequest(http.MethodGet, "/api/snippets", nil)
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "Intégrale de Gauss") {
		t.Fatalf("expected snippet in list, got %s", rec.Body.String())
	}

	// Export snippets
	req = httptest.NewRequest(http.MethodGet, "/api/snippets/export", nil)
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Header().Get("Content-Disposition"), "latex-studio-equations.json") {
		t.Fatalf("expected export attachment header, got code=%d disp=%s", rec.Code, rec.Header().Get("Content-Disposition"))
	}

	// Unknown API endpoint returns JSON 404
	req = httptest.NewRequest(http.MethodGet, "/api/unknown", nil)
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound || !strings.Contains(rec.Header().Get("Content-Type"), "application/json") {
		t.Fatalf("expected JSON 404 on unknown API path, got code=%d ct=%s", rec.Code, rec.Header().Get("Content-Type"))
	}

	// Import snippets
	importBody := bytes.NewBufferString(`[{"id":"imp-1","title":"Euler","latex":"e^{i\\pi}+1=0"}]`)
	req = httptest.NewRequest(http.MethodPost, "/api/snippets/import", importBody)
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"added":1`) {
		t.Fatalf("expected added:1 on import, got %d: %s", rec.Code, rec.Body.String())
	}

	// Delete snippet
	req = httptest.NewRequest(http.MethodDelete, "/api/snippets/"+created.ID, nil)
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 on delete, got %d", rec.Code)
	}

	// Create share & retrieve
	shareReq := bytes.NewBufferString(`{"latex":"\\ce{H2O}"}`)
	req = httptest.NewRequest(http.MethodPost, "/api/share", shareReq)
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201 on share create, got %d", rec.Code)
	}
	var shareResp struct {
		ID  string `json:"id"`
		URL string `json:"url"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &shareResp); err != nil {
		t.Fatalf("unmarshal shareResp: %v", err)
	}

	req = httptest.NewRequest(http.MethodGet, "/api/share/"+shareResp.ID, nil)
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `\ce{H2O}`) {
		t.Fatalf("expected shared latex, got %d: %s", rec.Code, rec.Body.String())
	}
}
