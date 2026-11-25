package server

import (
	"compress/gzip"
	"encoding/json"
	"io/fs"
	"net/http"
	"strings"
)

type Server struct {
	webFS  fs.FS
	mux    *http.ServeMux
	static http.Handler
}

// New constructs a stateless HTTP handler serving the installable offline PWA and /api/health.
func New(webFS fs.FS) http.Handler {
	s := &Server{
		webFS:  webFS,
		mux:    http.NewServeMux(),
		static: http.FileServer(http.FS(webFS)),
	}
	s.routes()
	return withSecurityAndGzip(s.mux)
}

func (s *Server) routes() {
	s.mux.HandleFunc("GET /api/health", s.handleHealth)
	s.mux.HandleFunc("/api/", s.handleAPINotFound)

	s.mux.HandleFunc("GET /sw.js", s.handleServiceWorker)
	s.mux.HandleFunc("GET /manifest.webmanifest", s.handleManifest)
	s.mux.HandleFunc("GET /icon.svg", s.handleCachedRootAsset("image/svg+xml"))
	s.mux.HandleFunc("GET /icon-192.png", s.handleCachedRootAsset("image/png"))
	s.mux.HandleFunc("GET /icon-512.png", s.handleCachedRootAsset("image/png"))

	s.mux.HandleFunc("GET /static/", s.handleStatic)
	s.mux.HandleFunc("GET /{$}", s.handleIndex)
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status": "ok",
		"engine": "go",
		"mode":   "offline-pwa",
	})
}

func (s *Server) handleAPINotFound(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusNotFound, map[string]string{
		"error": "Point d'entrée API introuvable",
	})
}

func (s *Server) handleServiceWorker(w http.ResponseWriter, _ *http.Request) {
	raw, err := fs.ReadFile(s.webFS, "sw.js")
	if err != nil {
		http.Error(w, "sw.js missing", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Service-Worker-Allowed", "/")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(raw)
}

func (s *Server) handleManifest(w http.ResponseWriter, _ *http.Request) {
	raw, err := fs.ReadFile(s.webFS, "manifest.webmanifest")
	if err != nil {
		http.Error(w, "manifest missing", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/manifest+json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(raw)
}

func (s *Server) handleCachedRootAsset(contentType string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(r.URL.Path, "/")
		raw, err := fs.ReadFile(s.webFS, name)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", contentType)
		w.Header().Set("Cache-Control", "public, max-age=86400")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(raw)
	}
}

func (s *Server) handleStatic(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(r.URL.Path, "/static/vendor/") {
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	} else {
		w.Header().Set("Cache-Control", "no-cache")
	}
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

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
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
		strings.Contains(ct, "application/manifest+json") ||
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
