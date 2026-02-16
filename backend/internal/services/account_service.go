package services

import (
	"database/sql"
	"fmt"
	"pooled-storage/internal/models"
	"pooled-storage/internal/rclone"
	"time"

	"github.com/google/uuid"
)

type AccountService struct {
	db      *sql.DB
	rclone  *rclone.Manager
}

func NewAccountService(db *sql.DB, rclone *rclone.Manager) *AccountService {
	return &AccountService{
		db:     db,
		rclone: rclone,
	}
}

func (s *AccountService) CreateAccount(req *models.CreateAccountRequest) (*models.Account, error) {
	account := &models.Account{
		ID:        uuid.New().String(),
		Name:      req.Name,
		Type:      req.Type,
		Email:     req.Email,
		Status:    "active",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if req.Token != "" {
		account.AccessToken = req.Token
	}

	// Add to rclone
	if err := s.rclone.AddRemote(account); err != nil {
		return nil, fmt.Errorf("failed to add remote: %w", err)
	}

	// Test connection
	if err := s.rclone.TestConnection(account.ID, account.Type); err != nil {
		s.rclone.RemoveRemote(account.ID, account.Type)
		return nil, fmt.Errorf("failed to connect to account: %w", err)
	}

	// Get quota
	total, used, err := s.rclone.GetQuota(account.ID, account.Type)
	if err == nil {
		account.QuotaTotal = total
		account.QuotaUsed = used
	}

	// Save to database
	query := `INSERT INTO accounts (id, name, type, email, access_token, quota_total, quota_used, status, created_at, updated_at)
			  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err = s.db.Exec(query, account.ID, account.Name, account.Type, account.Email,
		account.AccessToken, account.QuotaTotal, account.QuotaUsed, account.Status,
		account.CreatedAt, account.UpdatedAt)
	if err != nil {
		s.rclone.RemoveRemote(account.ID, account.Type)
		return nil, fmt.Errorf("failed to save account: %w", err)
	}

	return account, nil
}

func (s *AccountService) GetAccounts() ([]models.Account, error) {
	query := `SELECT id, name, type, email, quota_total, quota_used, status, created_at, updated_at
			  FROM accounts ORDER BY created_at DESC`
	
	rows, err := s.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var accounts []models.Account
	for rows.Next() {
		var account models.Account
		err := rows.Scan(&account.ID, &account.Name, &account.Type, &account.Email,
			&account.QuotaTotal, &account.QuotaUsed, &account.Status,
			&account.CreatedAt, &account.UpdatedAt)
		if err != nil {
			return nil, err
		}
		accounts = append(accounts, account)
	}

	return accounts, nil
}

func (s *AccountService) GetAccount(id string) (*models.Account, error) {
	query := `SELECT id, name, type, email, quota_total, quota_used, status, created_at, updated_at
			  FROM accounts WHERE id = ?`
	
	var account models.Account
	err := s.db.QueryRow(query, id).Scan(&account.ID, &account.Name, &account.Type, &account.Email,
		&account.QuotaTotal, &account.QuotaUsed, &account.Status,
		&account.CreatedAt, &account.UpdatedAt)
	if err != nil {
		return nil, err
	}

	return &account, nil
}

func (s *AccountService) DeleteAccount(id string) error {
	account, err := s.GetAccount(id)
	if err != nil {
		return err
	}

	// Remove from rclone
	if err := s.rclone.RemoveRemote(account.ID, account.Type); err != nil {
		return fmt.Errorf("failed to remove remote: %w", err)
	}

	// Delete from database
	_, err = s.db.Exec("DELETE FROM accounts WHERE id = ?", id)
	return err
}

func (s *AccountService) RefreshQuota(id string) error {
	account, err := s.GetAccount(id)
	if err != nil {
		return err
	}

	total, used, err := s.rclone.GetQuota(account.ID, account.Type)
	if err != nil {
		return err
	}

	query := `UPDATE accounts SET quota_total = ?, quota_used = ?, updated_at = ? WHERE id = ?`
	_, err = s.db.Exec(query, total, used, time.Now(), id)
	return err
}

func (s *AccountService) UpdateAccountStatus(id, status string) error {
	query := `UPDATE accounts SET status = ?, updated_at = ? WHERE id = ?`
	_, err := s.db.Exec(query, status, time.Now(), id)
	return err
}
