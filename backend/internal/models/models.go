package models

import "time"

type Account struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Type         string    `json:"type"` // google, microsoft
	Email        string    `json:"email"`
	AccessToken  string    `json:"-"`
	RefreshToken string    `json:"-"`
	TokenExpiry  time.Time `json:"token_expiry"`
	QuotaTotal   int64     `json:"quota_total"`
	QuotaUsed    int64     `json:"quota_used"`
	Status       string    `json:"status"` // active, inactive, error
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type StoragePool struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	Strategy        string    `json:"strategy"` // union, eplus, epall, epff
	EnableChunker   bool      `json:"enable_chunker"`
	AllowLargeFiles bool      `json:"allow_large_files"`
	ChunkSize       string    `json:"chunk_size"`
	MountPath       string    `json:"mount_path"`
	Status          string    `json:"status"` // stopped, starting, running, error
	Accounts        []Account `json:"accounts,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type PoolAccount struct {
	PoolID    string `json:"pool_id"`
	AccountID string `json:"account_id"`
	Priority  int    `json:"priority"`
}

type OAuthConfig struct {
	Provider     string    `json:"provider"`
	ClientID     string    `json:"client_id"`
	ClientSecret string    `json:"-"`
	RedirectURI  string    `json:"redirect_uri"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type StorageStats struct {
	TotalCapacity int64            `json:"total_capacity"`
	TotalUsed     int64            `json:"total_used"`
	TotalFree     int64            `json:"total_free"`
	AccountStats  []AccountStats   `json:"account_stats"`
	PoolStats     []PoolStats      `json:"pool_stats"`
}

type AccountStats struct {
	AccountID     string  `json:"account_id"`
	Name          string  `json:"name"`
	Email         string  `json:"email"`
	Type          string  `json:"type"`
	QuotaTotal    int64   `json:"quota_total"`
	QuotaUsed     int64   `json:"quota_used"`
	QuotaFree     int64   `json:"quota_free"`
	UsagePercent  float64 `json:"usage_percent"`
	Status        string  `json:"status"`
}

type PoolStats struct {
	PoolID        string  `json:"pool_id"`
	Name          string  `json:"name"`
	TotalCapacity int64   `json:"total_capacity"`
	TotalUsed     int64   `json:"total_used"`
	TotalFree     int64   `json:"total_free"`
	UsagePercent  float64 `json:"usage_percent"`
	Status        string  `json:"status"`
	AccountCount  int     `json:"account_count"`
}

type CreateAccountRequest struct {
	Name  string `json:"name"`
	Type  string `json:"type"` // google, microsoft
	Email string `json:"email"`
	Token string `json:"token,omitempty"` // Manual token
}

type CreatePoolRequest struct {
	Name            string   `json:"name"`
	Strategy        string   `json:"strategy"`
	EnableChunker   bool     `json:"enable_chunker"`
	AllowLargeFiles bool     `json:"allow_large_files"`
	ChunkSize       string   `json:"chunk_size"`
	AccountIDs      []string `json:"account_ids"`
}

type OAuthStartRequest struct {
	Provider string `json:"provider"` // google, microsoft
}

type OAuthCallbackRequest struct {
	Code     string `json:"code"`
	State    string `json:"state"`
	Provider string `json:"provider"`
}
