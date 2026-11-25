package store

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

var (
	ErrNotFound = errors.New("not found")
	ErrInvalid  = errors.New("invalid input")
)

// SavedEquation represents a persisted snippet.
type SavedEquation struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Latex     string `json:"latex"`
	CreatedAt int64  `json:"createdAt"`
	UpdatedAt int64  `json:"updatedAt"`
	Pinned    bool   `json:"pinned"`
}

// SharedEquation represents a short-URL shared formula.
type SharedEquation struct {
	ID        string `json:"id"`
	Latex     string `json:"latex"`
	CreatedAt int64  `json:"createdAt"`
}

type diskState struct {
	Snippets []SavedEquation           `json:"snippets"`
	Shares   map[string]SharedEquation `json:"shares"`
}

// Store provides thread-safe JSON file persistence for snippets and shared URLs.
type Store struct {
	mu       sync.RWMutex
	filePath string
	state    diskState
}

// New initializes a Store inside dataDir and loads existing data if present.
func New(dataDir string) (*Store, error) {
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return nil, err
	}
	filePath := filepath.Join(dataDir, "store.json")
	s := &Store{
		filePath: filePath,
		state: diskState{
			Snippets: []SavedEquation{},
			Shares:   map[string]SharedEquation{},
		},
	}

	raw, err := os.ReadFile(filePath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return s, nil
		}
		return nil, err
	}
	if len(strings.TrimSpace(string(raw))) > 0 {
		if err := json.Unmarshal(raw, &s.state); err != nil {
			return nil, err
		}
	}
	if s.state.Snippets == nil {
		s.state.Snippets = []SavedEquation{}
	}
	if s.state.Shares == nil {
		s.state.Shares = map[string]SharedEquation{}
	}
	return s, nil
}

func (s *Store) saveLocked() error {
	payload, err := json.MarshalIndent(s.state, "", "  ")
	if err != nil {
		return err
	}
	tmpPath := s.filePath + ".tmp"
	if err := os.WriteFile(tmpPath, payload, 0o644); err != nil {
		return err
	}
	return os.Rename(tmpPath, s.filePath)
}

func generateID(nBytes int) (string, error) {
	buf := make([]byte, nBytes)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

// ListSnippets returns snippets sorted with pinned items first, then most recently updated.
func (s *Store) ListSnippets() []SavedEquation {
	s.mu.RLock()
	defer s.mu.RUnlock()

	out := make([]SavedEquation, len(s.state.Snippets))
	copy(out, s.state.Snippets)
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Pinned != out[j].Pinned {
			return out[i].Pinned
		}
		return out[i].UpdatedAt > out[j].UpdatedAt
	})
	return out
}

// CreateSnippet persists a new saved equation.
func (s *Store) CreateSnippet(title, latex string) (SavedEquation, error) {
	trimmedLatex := strings.TrimSpace(latex)
	if trimmedLatex == "" {
		return SavedEquation{}, ErrInvalid
	}
	trimmedTitle := strings.TrimSpace(title)
	if trimmedTitle == "" {
		firstLine := strings.TrimSpace(strings.Split(trimmedLatex, "\n")[0])
		if len(firstLine) > 40 {
			trimmedTitle = firstLine[:40] + "…"
		} else if firstLine != "" {
			trimmedTitle = firstLine
		} else {
			trimmedTitle = "Équation sans titre"
		}
	}

	id, err := generateID(8)
	if err != nil {
		return SavedEquation{}, err
	}
	now := time.Now().UnixMilli()
	item := SavedEquation{
		ID:        id,
		Title:     trimmedTitle,
		Latex:     trimmedLatex,
		CreatedAt: now,
		UpdatedAt: now,
		Pinned:    false,
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.state.Snippets = append([]SavedEquation{item}, s.state.Snippets...)
	if err := s.saveLocked(); err != nil {
		return SavedEquation{}, err
	}
	return item, nil
}

// UpdateSnippet updates title and/or pinned flag for a snippet ID.
func (s *Store) UpdateSnippet(id string, title *string, pinned *bool) (SavedEquation, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i := range s.state.Snippets {
		if s.state.Snippets[i].ID == id {
			if title != nil {
				t := strings.TrimSpace(*title)
				if t != "" {
					s.state.Snippets[i].Title = t
				}
			}
			if pinned != nil {
				s.state.Snippets[i].Pinned = *pinned
			}
			s.state.Snippets[i].UpdatedAt = time.Now().UnixMilli()
			if err := s.saveLocked(); err != nil {
				return SavedEquation{}, err
			}
			return s.state.Snippets[i], nil
		}
	}
	return SavedEquation{}, ErrNotFound
}

// DeleteSnippet removes a snippet by ID.
func (s *Store) DeleteSnippet(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i := range s.state.Snippets {
		if s.state.Snippets[i].ID == id {
			s.state.Snippets = append(s.state.Snippets[:i], s.state.Snippets[i+1:]...)
			return s.saveLocked()
		}
	}
	return ErrNotFound
}

// ImportSnippets merges external snippets without duplicating existing IDs.
func (s *Store) ImportSnippets(items []SavedEquation) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	existing := make(map[string]struct{}, len(s.state.Snippets))
	for _, sn := range s.state.Snippets {
		existing[sn.ID] = struct{}{}
	}

	added := 0
	now := time.Now().UnixMilli()
	for _, item := range items {
		if strings.TrimSpace(item.Latex) == "" {
			continue
		}
		if item.ID == "" {
			id, err := generateID(8)
			if err != nil {
				return added, err
			}
			item.ID = id
		}
		if _, dup := existing[item.ID]; dup {
			continue
		}
		if strings.TrimSpace(item.Title) == "" {
			item.Title = "Équation importée"
		}
		if item.CreatedAt == 0 {
			item.CreatedAt = now
		}
		if item.UpdatedAt == 0 {
			item.UpdatedAt = now
		}
		existing[item.ID] = struct{}{}
		s.state.Snippets = append(s.state.Snippets, item)
		added++
	}

	if added > 0 {
		if err := s.saveLocked(); err != nil {
			return 0, err
		}
	}
	return added, nil
}

// CreateShare stores a shared LaTeX formula under an 8-char URL-safe ID.
func (s *Store) CreateShare(latex string) (SharedEquation, error) {
	trimmed := strings.TrimSpace(latex)
	if trimmed == "" {
		return SharedEquation{}, ErrInvalid
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	var id string
	for {
		gen, err := generateID(6) // 8 base64url chars
		if err != nil {
			return SharedEquation{}, err
		}
		if _, exists := s.state.Shares[gen]; !exists {
			id = gen
			break
		}
	}

	entry := SharedEquation{
		ID:        id,
		Latex:     trimmed,
		CreatedAt: time.Now().UnixMilli(),
	}
	s.state.Shares[id] = entry
	if err := s.saveLocked(); err != nil {
		return SharedEquation{}, err
	}
	return entry, nil
}

// GetShare retrieves a shared equation by ID.
func (s *Store) GetShare(id string) (SharedEquation, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	entry, ok := s.state.Shares[id]
	if !ok {
		return SharedEquation{}, ErrNotFound
	}
	return entry, nil
}
