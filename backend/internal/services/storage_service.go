package services

import (
	"database/sql"
	"fmt"
	"pooled-storage/internal/models"
	"pooled-storage/internal/rclone"
	"time"

	"github.com/google/uuid"
)

type StorageService struct {
	db     *sql.DB
	rclone *rclone.Manager
}

func NewStorageService(db *sql.DB, rclone *rclone.Manager) *StorageService {
	return &StorageService{
		db:     db,
		rclone: rclone,
	}
}

func (s *StorageService) CreatePool(req *models.CreatePoolRequest) (*models.StoragePool, error) {
	pool := &models.StoragePool{
		ID:              uuid.New().String(),
		Name:            req.Name,
		Strategy:        req.Strategy,
		EnableChunker:   req.EnableChunker,
		AllowLargeFiles: req.AllowLargeFiles,
		ChunkSize:       req.ChunkSize,
		Status:          "stopped",
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	if pool.ChunkSize == "" {
		pool.ChunkSize = "100M"
	}

	// Start transaction
	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// Insert pool
	query := `INSERT INTO storage_pools (id, name, strategy, enable_chunker, allow_large_files, chunk_size, status, created_at, updated_at)
			  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err = tx.Exec(query, pool.ID, pool.Name, pool.Strategy, pool.EnableChunker,
		pool.AllowLargeFiles, pool.ChunkSize, pool.Status, pool.CreatedAt, pool.UpdatedAt)
	if err != nil {
		return nil, err
	}

	// Add accounts to pool
	for i, accountID := range req.AccountIDs {
		query = `INSERT INTO pool_accounts (pool_id, account_id, priority) VALUES (?, ?, ?)`
		_, err = tx.Exec(query, pool.ID, accountID, i)
		if err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return pool, nil
}

func (s *StorageService) GetPools() ([]models.StoragePool, error) {
	query := `SELECT id, name, strategy, enable_chunker, allow_large_files, chunk_size, mount_path, status, created_at, updated_at
			  FROM storage_pools ORDER BY created_at DESC`
	
	rows, err := s.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var pools []models.StoragePool
	for rows.Next() {
		var pool models.StoragePool
		var mountPath sql.NullString
		err := rows.Scan(&pool.ID, &pool.Name, &pool.Strategy, &pool.EnableChunker,
			&pool.AllowLargeFiles, &pool.ChunkSize, &mountPath, &pool.Status,
			&pool.CreatedAt, &pool.UpdatedAt)
		if err != nil {
			return nil, err
		}
		if mountPath.Valid {
			pool.MountPath = mountPath.String
		}
		
		// Get accounts for this pool
		accounts, _ := s.GetPoolAccounts(pool.ID)
		pool.Accounts = accounts

		pools = append(pools, pool)
	}

	return pools, nil
}

func (s *StorageService) GetPool(id string) (*models.StoragePool, error) {
	query := `SELECT id, name, strategy, enable_chunker, allow_large_files, chunk_size, mount_path, status, created_at, updated_at
			  FROM storage_pools WHERE id = ?`
	
	var pool models.StoragePool
	var mountPath sql.NullString
	err := s.db.QueryRow(query, id).Scan(&pool.ID, &pool.Name, &pool.Strategy,
		&pool.EnableChunker, &pool.AllowLargeFiles, &pool.ChunkSize, &mountPath,
		&pool.Status, &pool.CreatedAt, &pool.UpdatedAt)
	if err != nil {
		return nil, err
	}

	if mountPath.Valid {
		pool.MountPath = mountPath.String
	}

	// Get accounts for this pool
	accounts, _ := s.GetPoolAccounts(pool.ID)
	pool.Accounts = accounts

	return &pool, nil
}

func (s *StorageService) GetPoolAccounts(poolID string) ([]models.Account, error) {
	query := `SELECT a.id, a.name, a.type, a.email, a.quota_total, a.quota_used, a.status, a.created_at, a.updated_at
			  FROM accounts a
			  INNER JOIN pool_accounts pa ON a.id = pa.account_id
			  WHERE pa.pool_id = ?
			  ORDER BY pa.priority`
	
	rows, err := s.db.Query(query, poolID)
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

func (s *StorageService) StartPool(id string) error {
	pool, err := s.GetPool(id)
	if err != nil {
		return err
	}

	if pool.Status == "running" {
		return fmt.Errorf("pool already running")
	}

	// Update status to starting
	s.updatePoolStatus(id, "starting")

	// Create union
	if err := s.rclone.CreateUnion(pool); err != nil {
		s.updatePoolStatus(id, "error")
		return fmt.Errorf("failed to create union: %w", err)
	}

	// Mount pool
	if err := s.rclone.MountPool(pool); err != nil {
		s.updatePoolStatus(id, "error")
		return fmt.Errorf("failed to mount pool: %w", err)
	}

	// Update status and mount path
	mountPath := fmt.Sprintf("/mnt/pooled-storage/%s", pool.ID)
	query := `UPDATE storage_pools SET status = ?, mount_path = ?, updated_at = ? WHERE id = ?`
	_, err = s.db.Exec(query, "running", mountPath, time.Now(), id)

	return err
}

func (s *StorageService) StopPool(id string) error {
	pool, err := s.GetPool(id)
	if err != nil {
		return err
	}

	if pool.Status != "running" {
		return fmt.Errorf("pool not running")
	}

	// Unmount
	if err := s.rclone.UnmountPool(pool); err != nil {
		return fmt.Errorf("failed to unmount pool: %w", err)
	}

	// Delete union
	s.rclone.DeleteUnion(pool.ID)

	// Update status
	query := `UPDATE storage_pools SET status = ?, mount_path = NULL, updated_at = ? WHERE id = ?`
	_, err = s.db.Exec(query, "stopped", time.Now(), id)

	return err
}

func (s *StorageService) DeletePool(id string) error {
	pool, err := s.GetPool(id)
	if err != nil {
		return err
	}

	if pool.Status == "running" {
		if err := s.StopPool(id); err != nil {
			return err
		}
	}

	_, err = s.db.Exec("DELETE FROM storage_pools WHERE id = ?", id)
	return err
}

func (s *StorageService) AddAccountToPool(poolID, accountID string) error {
	query := `INSERT INTO pool_accounts (pool_id, account_id, priority)
			  SELECT ?, ?, COALESCE(MAX(priority), 0) + 1 FROM pool_accounts WHERE pool_id = ?`
	_, err := s.db.Exec(query, poolID, accountID, poolID)
	return err
}

func (s *StorageService) RemoveAccountFromPool(poolID, accountID string) error {
	_, err := s.db.Exec("DELETE FROM pool_accounts WHERE pool_id = ? AND account_id = ?", poolID, accountID)
	return err
}

func (s *StorageService) updatePoolStatus(id, status string) {
	query := `UPDATE storage_pools SET status = ?, updated_at = ? WHERE id = ?`
	s.db.Exec(query, status, time.Now(), id)
}
