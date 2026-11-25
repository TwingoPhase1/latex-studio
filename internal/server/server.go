package server

import (
	"compress/gzip"
	"encoding/json"
	"errors"
	"io"
	"io/fs"
	"net/http"
	"strings"

	"latex-studio/internal/data"
	"latex-studio/internal/store"
)

const maxJSONBodyBytes = 1 << 20 // 1 MB

type Server struct {
	store  *store.Store
	webFS  fs.FS
	mux    *http.ServeMux
	static http.Handler
}

// New constructs the HTTP handler with API endpoints, embedded frontend, security headers, and gzip.
func New(st *store.Store, webFS fs.FS) http.Handler {
	s := &Server{
		store:  st,
		webFS:  webFS,
		mux:    http.NewServeMux(),
		static: http.FileServer(http.FS(webFS)),
	}
	s.routes()
	return withSecurityAndGzip(s.mux)
}

func (s *Server) routes() {
	s.mux.HandleFunc("GET /api/health", s.handleHealth)
	s.mux.HandleFunc("GET /api/symbols", s.handleSymbols)
	s.mux.HandleFunc("GET /api/templates", s.handleTemplates)

	s.mux.HandleFunc("GET /api/snippets", s.handleListSnippets)
	s.mux.HandleFunc("GET /api/snippets/export", s.handleExportSnippets)
	s.mux.HandleFunc("POST /api/snippets", s.handleCreateSnippet)
	s.mux.HandleFunc("PATCH /api/snippets/{id}", s.handleUpdateSnippet)
	s.mux.HandleFunc("DELETE /api/snippets/{id}", s.handleDeleteSnippet)
	s.mux.HandleFunc("POST /api/snippets/import", s.handleImportSnippets)

	s.mux.HandleFunc("POST /api/share", s.handleCreateShare)
	s.mux.HandleFunc("GET /api/share/{id}", s.handleGetShare)
	s.mux.HandleFunc("/api/", s.handleAPINotFound)

	s.mux.HandleFunc("GET /static/", s.handleStatic)
	s.mux.HandleFunc("GET /s/{id}", s.handleIndex)
	s.mux.HandleFunc("GET /{$}", s.handleIndex)
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status": "ok",
		"engine": "go",
	})
}

func (s *Server) handleSymbols(w http.ResponseWriter, r *http.Request) {
	category := r.URL.Query().Get("category")
	query := r.URL.Query().Get("q")
	writeJSON(w, http.StatusOK, map[string]any{
		"categories": data.SymbolCategories,
		"symbols":    data.FilterSymbols(category, query),
	})
}

func (s *Server) handleTemplates(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"templates": data.Templates,
	})
}

func (s *Server) handleListSnippets(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"snippets": s.store.ListSnippets(),
	})
}

func (s *Server) handleExportSnippets(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Disposition", `attachment; filename="latex-studio-equations.json"`)
	writeJSON(w, http.StatusOK, s.store.ListSnippets())
}

func (s *Server) handleAPINotFound(w http.ResponseWriter, _ *http.Request) {
	writeError(w, http.StatusNotFound, "Point d'entrée API introuvable")
}

func (s *Server) handleCreateSnippet(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Title string `json:"title"`
		Latex string `json:"latex"`
	}
	if err := decodeJSON(w, r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "Corps JSON invalide")
		return
	}
	created, err := s.store.CreateSnippet(body.Title, body.Latex)
	if err != nil {
		if errors.Is(err, store.ErrInvalid) {
			writeError(w, http.StatusBadRequest, "Le code LaTeX ne peut pas être vide")
			return
		}
		writeError(w, http.StatusInternalServerError, "Erreur lors de l'enregistrement")
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

func (s *Server) handleUpdateSnippet(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var body struct {
		Title  *string `json:"title"`
		Pinned *bool   `json:"pinned"`
	}
	if err := decodeJSON(w, r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "Corps JSON invalide")
		return
	}
	updated, err := s.store.UpdateSnippet(id, body.Title, body.Pinned)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Équation introuvable")
			return
		}
		writeError(w, http.StatusInternalServerError, "Erreur de mise à jour")
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) handleDeleteSnippet(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := s.store.DeleteSnippet(id); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Équation introuvable")
			return
		}
		writeError(w, http.StatusInternalServerError, "Erreur de suppression")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"deleted": true})
}

func (s *Server) handleImportSnippets(w http.ResponseWriter, r *http.Request) {
	var items []store.SavedEquation
	if err := decodeJSON(w, r, &items); err != nil {
		writeError(w, http.StatusBadRequest, "Format JSON d'import invalide")
		return
	}
	added, err := s.store.ImportSnippets(items)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Erreur lors de l'import")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"added":    added,
		"snippets": s.store.ListSnippets(),
	})
}

func (s *Server) handleCreateShare(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Latex string `json:"latex"`
	}
	if err := decodeJSON(w, r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "Corps JSON invalide")
		return
	}
	shared, err := s.store.CreateShare(body.Latex)
	if err != nil {
		if errors.Is(err, store.ErrInvalid) {
			writeError(w, http.StatusBadRequest, "Le code LaTeX ne peut pas être vide")
			return
		}
		writeError(w, http.StatusInternalServerError, "Erreur lors de la création du lien")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{
		"id":  shared.ID,
		"url": "/s/" + shared.ID,
	})
}

func (s *Server) handleGetShare(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	shared, err := s.store.GetShare(id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Lien de partage introuvable")
			return
		}
		writeError(w, http.StatusInternalServerError, "Erreur serveur")
		return
	}
	writeJSON(w, http.StatusOK, shared)
}

func (s *Server) handleStatic(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "public, max-age=3600")
	s.static.ServeHTTP(w, r)
}

func (s *Server) handleIndex(w http.ResponseWriter, _ *http.Request) {
	raw, err := fs.ReadFile(s.webFS, "index.html")
	if err != nil {
		http.Error(w, "index.html missing", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(raw)
}

func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) error {
	r.Body = http.MaxBytesReader(w, r.Body, maxJSONBodyBytes)
	defer r.Body.Close()
	dec := json.NewDecoder(r.Body)
	return dec.Decode(dst)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

type gzipResponseWriter struct {
	http.ResponseWriter
	gz          *gzip.Writer
	wroteHeader bool
	shouldGzip  bool
}

func (g *gzipResponseWriter) WriteHeader(code int) {
	if g.wroteHeader {
		return
	}
	g.wroteHeader = true
	ct := strings.ToLower(g.Header().Get("Content-Type"))
	if strings.Contains(ct, "application/json") ||
		strings.Contains(ct, "text/html") ||
		strings.Contains(ct, "text/css") ||
		strings.Contains(ct, "javascript") ||
		strings.Contains(ct, "image/svg+xml") {
		g.shouldGzip = true
		g.Header().Del("Content-Length")
		g.Header().Set("Content-Encoding", "gzip")
		g.Header().Add("Vary", "Accept-Encoding")
		g.gz = gzip.NewWriter(g.ResponseWriter)
	}
	g.ResponseWriter.WriteHeader(code)
}

func (g *gzipResponseWriter) Write(p []byte) (int, error) {
	if !g.wroteHeader {
		if g.Header().Get("Content-Type") == "" {
			g.Header().Set("Content-Type", http.DetectContentType(p))
		}
		g.WriteHeader(http.StatusOK)
	}
	if g.shouldGzip && g.gz != nil {
		return g.gz.Write(p)
	}
	return g.ResponseWriter.Write(p)
}

func withSecurityAndGzip(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "same-origin")

		if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
			next.ServeHTTP(w, r)
			return
		}

		grw := &gzipResponseWriter{ResponseWriter: w}
		defer func() {
			if grw.gz != nil {
				_ = grw.gz.Close()
			}
		}()
		next.ServeHTTP(grw, r)
	})
}

// Unused import safeguard if needed in future edits.
var _ = io.EOF
