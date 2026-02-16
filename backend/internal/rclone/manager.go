package rclone

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"pooled-storage/internal/models"
	"strings"
	"time"
)

type Manager struct {
	configPath string
	mountPath  string
}

func NewManager() *Manager {
	configPath := os.Getenv("RCLONE_CONFIG_PATH")
	if configPath == "" {
		configPath = filepath.Join(os.Getenv("HOME"), ".config/rclone/rclone.conf")
	}

	mountPath := os.Getenv("MOUNT_PATH")
	if mountPath == "" {
		mountPath = "/mnt/pooled-storage"
	}

	// Ensure directories exist
	os.MkdirAll(filepath.Dir(configPath), 0755)
	os.MkdirAll(mountPath, 0755)

	return &Manager{
		configPath: configPath,
		mountPath:  mountPath,
	}
}

func (m *Manager) AddRemote(account *models.Account) error {
	remoteName := fmt.Sprintf("%s_%s", account.Type, account.ID)

	var cmd *exec.Cmd
	switch account.Type {
	case "google":
		cmd = exec.Command("rclone", "config", "create", remoteName, "drive",
			"--drive-token", account.AccessToken,
			"--drive-scope", "drive",
			"--config", m.configPath)
	case "microsoft":
		cmd = exec.Command("rclone", "config", "create", remoteName, "onedrive",
			"--onedrive-token", account.AccessToken,
			"--config", m.configPath)
	default:
		return fmt.Errorf("unsupported account type: %s", account.Type)
	}

	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to add remote: %s - %s", err, string(output))
	}

	return nil
}

func (m *Manager) RemoveRemote(accountID, accountType string) error {
	remoteName := fmt.Sprintf("%s_%s", accountType, accountID)
	cmd := exec.Command("rclone", "config", "delete", remoteName, "--config", m.configPath)
	return cmd.Run()
}

func (m *Manager) CreateUnion(pool *models.StoragePool) error {
	if len(pool.Accounts) == 0 {
		return fmt.Errorf("no accounts in pool")
	}

	var upstreams []string
	for _, account := range pool.Accounts {
		remoteName := fmt.Sprintf("%s_%s:", account.Type, account.ID)
		
		if pool.EnableChunker {
			// Wrap in chunker
			chunkRemote := fmt.Sprintf("chunk_%s", account.ID)
			chunkerCmd := exec.Command("rclone", "config", "create", chunkRemote, "chunker",
				"--chunker-remote", remoteName,
				"--chunker-chunk-size", pool.ChunkSize,
				"--config", m.configPath)
			if err := chunkerCmd.Run(); err != nil {
				return fmt.Errorf("failed to create chunker: %w", err)
			}
			upstreams = append(upstreams, chunkRemote+":")
		} else {
			upstreams = append(upstreams, remoteName)
		}
	}

	unionRemote := fmt.Sprintf("union_%s", pool.ID)
	upstreamStr := strings.Join(upstreams, " ")

	var policyArgs []string
	switch pool.Strategy {
	case "union":
		policyArgs = []string{
			"--union-action-policy", "epall",
			"--union-create-policy", "epmfs",
			"--union-search-policy", "ff",
		}
	case "eplus":
		policyArgs = []string{
			"--union-action-policy", "epall",
			"--union-create-policy", "eplus",
			"--union-search-policy", "ff",
		}
	case "epff":
		policyArgs = []string{
			"--union-action-policy", "epall",
			"--union-create-policy", "epff",
			"--union-search-policy", "ff",
		}
	case "mirror":
		policyArgs = []string{
			"--union-action-policy", "all",
			"--union-create-policy", "all",
			"--union-search-policy", "ff",
		}
	default:
		policyArgs = []string{
			"--union-action-policy", "epall",
			"--union-create-policy", "epmfs",
			"--union-search-policy", "ff",
		}
	}

	args := append([]string{"config", "create", unionRemote, "union",
		"--union-upstreams", upstreamStr,
		"--config", m.configPath}, policyArgs...)

	cmd := exec.Command("rclone", args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to create union: %s - %s", err, string(output))
	}

	return nil
}

func (m *Manager) MountPool(pool *models.StoragePool) error {
	unionRemote := fmt.Sprintf("union_%s:", pool.ID)
	poolMountPath := filepath.Join(m.mountPath, pool.ID)

	// Create mount directory
	if err := os.MkdirAll(poolMountPath, 0755); err != nil {
		return fmt.Errorf("failed to create mount directory: %w", err)
	}

	// Check if already mounted
	if m.IsMounted(poolMountPath) {
		return fmt.Errorf("already mounted")
	}

	args := []string{
		"mount", unionRemote, poolMountPath,
		"--config", m.configPath,
		"--allow-other",
		"--vfs-cache-mode", "writes",
		"--daemon",
	}

	if pool.AllowLargeFiles {
		args = append(args, "--vfs-cache-max-size", "50G")
	}

	cmd := exec.Command("rclone", args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to mount: %s - %s", err, string(output))
	}

	// Wait for mount to be ready
	time.Sleep(2 * time.Second)

	return nil
}

func (m *Manager) UnmountPool(pool *models.StoragePool) error {
	poolMountPath := filepath.Join(m.mountPath, pool.ID)

	cmd := exec.Command("fusermount", "-u", poolMountPath)
	if err := cmd.Run(); err != nil {
		// Try umount as fallback
		cmd = exec.Command("umount", poolMountPath)
		return cmd.Run()
	}

	return nil
}

func (m *Manager) IsMounted(path string) bool {
	cmd := exec.Command("mountpoint", "-q", path)
	return cmd.Run() == nil
}

func (m *Manager) GetQuota(accountID, accountType string) (int64, int64, error) {
	remoteName := fmt.Sprintf("%s_%s:", accountType, accountID)
	cmd := exec.Command("rclone", "about", remoteName,
		"--json",
		"--config", m.configPath)

	var out bytes.Buffer
	cmd.Stdout = &out
	if err := cmd.Run(); err != nil {
		return 0, 0, err
	}

	var result struct {
		Total int64 `json:"total"`
		Used  int64 `json:"used"`
	}

	if err := json.Unmarshal(out.Bytes(), &result); err != nil {
		return 0, 0, err
	}

	return result.Total, result.Used, nil
}

func (m *Manager) TestConnection(accountID, accountType string) error {
	remoteName := fmt.Sprintf("%s_%s:", accountType, accountID)
	cmd := exec.Command("rclone", "lsd", remoteName,
		"--max-depth", "1",
		"--config", m.configPath)

	return cmd.Run()
}

func (m *Manager) DeleteUnion(poolID string) error {
	unionRemote := fmt.Sprintf("union_%s", poolID)
	cmd := exec.Command("rclone", "config", "delete", unionRemote, "--config", m.configPath)
	return cmd.Run()
}
