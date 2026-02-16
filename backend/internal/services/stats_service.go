package services

import (
	"database/sql"
	"pooled-storage/internal/models"
	"pooled-storage/internal/rclone"
)

type StatsService struct {
	db     *sql.DB
	rclone *rclone.Manager
}

func NewStatsService(db *sql.DB, rclone *rclone.Manager) *StatsService {
	return &StatsService{
		db:     db,
		rclone: rclone,
	}
}

func (s *StatsService) GetStorageStats() (*models.StorageStats, error) {
	stats := &models.StorageStats{
		AccountStats: []models.AccountStats{},
		PoolStats:    []models.PoolStats{},
	}

	// Get account stats
	accountStats, err := s.GetAccountStats()
	if err == nil {
		stats.AccountStats = accountStats
		
		// Calculate totals
		for _, as := range accountStats {
			stats.TotalCapacity += as.QuotaTotal
			stats.TotalUsed += as.QuotaUsed
		}
		stats.TotalFree = stats.TotalCapacity - stats.TotalUsed
	}

	// Get pool stats
	poolStats, err := s.GetPoolStats()
	if err == nil {
		stats.PoolStats = poolStats
	}

	return stats, nil
}

func (s *StatsService) GetAccountStats() ([]models.AccountStats, error) {
	query := `SELECT id, name, email, type, quota_total, quota_used, status
			  FROM accounts
			  ORDER BY name`
	
	rows, err := s.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats []models.AccountStats
	for rows.Next() {
		var as models.AccountStats
		err := rows.Scan(&as.AccountID, &as.Name, &as.Email, &as.Type,
			&as.QuotaTotal, &as.QuotaUsed, &as.Status)
		if err != nil {
			continue
		}

		as.QuotaFree = as.QuotaTotal - as.QuotaUsed
		if as.QuotaTotal > 0 {
			as.UsagePercent = float64(as.QuotaUsed) / float64(as.QuotaTotal) * 100
		}

		stats = append(stats, as)
	}

	return stats, nil
}

func (s *StatsService) GetPoolStats() ([]models.PoolStats, error) {
	query := `SELECT sp.id, sp.name, sp.status, COUNT(pa.account_id) as account_count
			  FROM storage_pools sp
			  LEFT JOIN pool_accounts pa ON sp.id = pa.pool_id
			  GROUP BY sp.id, sp.name, sp.status
			  ORDER BY sp.name`
	
	rows, err := s.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats []models.PoolStats
	for rows.Next() {
		var ps models.PoolStats
		err := rows.Scan(&ps.PoolID, &ps.Name, &ps.Status, &ps.AccountCount)
		if err != nil {
			continue
		}

		// Get total capacity from accounts
		accountQuery := `SELECT SUM(a.quota_total), SUM(a.quota_used)
						 FROM accounts a
						 INNER JOIN pool_accounts pa ON a.id = pa.account_id
						 WHERE pa.pool_id = ?`
		
		var totalCap, totalUsed sql.NullInt64
		s.db.QueryRow(accountQuery, ps.PoolID).Scan(&totalCap, &totalUsed)
		
		if totalCap.Valid {
			ps.TotalCapacity = totalCap.Int64
		}
		if totalUsed.Valid {
			ps.TotalUsed = totalUsed.Int64
		}
		
		ps.TotalFree = ps.TotalCapacity - ps.TotalUsed
		if ps.TotalCapacity > 0 {
			ps.UsagePercent = float64(ps.TotalUsed) / float64(ps.TotalCapacity) * 100
		}

		stats = append(stats, ps)
	}

	return stats, nil
}

func (s *StatsService) RefreshAllQuotas() error {
	query := `SELECT id, type FROM accounts WHERE status = 'active'`
	rows, err := s.db.Query(query)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var id, accountType string
		if err := rows.Scan(&id, &accountType); err != nil {
			continue
		}

		total, used, err := s.rclone.GetQuota(id, accountType)
		if err != nil {
			continue
		}

		updateQuery := `UPDATE accounts SET quota_total = ?, quota_used = ? WHERE id = ?`
		s.db.Exec(updateQuery, total, used, id)
	}

	return nil
}
