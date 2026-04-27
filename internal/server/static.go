package server

import (
	"embed"
	"io/fs"
	"net/http"
	"path"
	"strings"

	"github.com/gin-gonic/gin"
)

// staticFS embeds the frontend production build at compile time.
// The Dockerfile copies frontend/dist into ./internal/server/static
// just before `go build` runs.
//
// If you build outside Docker without that copy, this will fail at compile
// time. To support a "no static" dev build, create an empty index.html in
// internal/server/static/.
//
//go:embed all:static
var staticFS embed.FS

// serveStatic registers handlers that serve the React SPA.
// All non-API routes are handled here:
//   - /assets/*  → serve from embedded /static/assets/
//   - /favicon, /vite.svg, etc → serve from embedded /static/
//   - anything else → serve index.html (so client-side routing works)
func (s *Server) serveStatic() {
	// Strip the embed prefix so "static/index.html" becomes "index.html"
	sub, err := fs.Sub(staticFS, "static")
	if err != nil {
		// Embedded FS missing — log and bail
		return
	}

	// Helper: serve a specific file from the embedded FS
	serveFile := func(c *gin.Context, filename string) {
		filename = strings.TrimPrefix(filename, "/")
		if filename == "" {
			filename = "index.html"
		}

		data, err := fs.ReadFile(sub, filename)
		if err != nil {
			// Not found in static — fall back to index.html for SPA routing
			data, err = fs.ReadFile(sub, "index.html")
			if err != nil {
				c.String(http.StatusNotFound, "not found")
				return
			}
			filename = "index.html"
		}

		// Set content type based on extension
		ext := path.Ext(filename)
		ct := contentType(ext)
		c.Data(http.StatusOK, ct, data)
	}

	// Catch-all: anything that wasn't matched by an API route lands here.
	// Gin's NoRoute handler runs after all defined routes have been tried.
	s.router.NoRoute(func(c *gin.Context) {
		// Don't intercept API requests — return 404 properly
		if strings.HasPrefix(c.Request.URL.Path, "/api/") {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		serveFile(c, c.Request.URL.Path)
	})
}

func contentType(ext string) string {
	switch ext {
	case ".html":
		return "text/html; charset=utf-8"
	case ".js":
		return "application/javascript; charset=utf-8"
	case ".css":
		return "text/css; charset=utf-8"
	case ".svg":
		return "image/svg+xml"
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".ico":
		return "image/x-icon"
	case ".json":
		return "application/json"
	case ".woff":
		return "font/woff"
	case ".woff2":
		return "font/woff2"
	default:
		return "application/octet-stream"
	}
}
