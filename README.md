# Pooled Storage Manager

A professional web-based dashboard for managing pooled storage using Google Drive and Microsoft OneDrive via rclone.

## Features

- 🎨 **Beautiful Professional Dashboard** - Modern, responsive UI with dark theme
- 🔐 **Multiple Authentication Methods** - OAuth, Service Accounts, Remote Authentication
- 💾 **Multiple Storage Pools** - Create and manage multiple independent pooled storage instances
- 🔄 **Chunker Support** - Enable file splitting for large files exceeding drive size limits
- 📊 **Real-time Monitoring** - Live statistics for accounts and pools
- 🌐 **Multiple Mount Protocols** - WebDAV, NFS, and SMB support for OpenMediaVault
- ⚡ **WebSocket Updates** - Real-time dashboard updates
- 🐳 **Docker Ready** - Easy deployment with Docker Compose

## Quick Start

### Installation on Raspberry Pi

```bash
# 1. Create directories
sudo mkdir -p /var/lib/docker/pooled-storage/config
sudo mkdir -p /var/lib/docker/pooled-storage/data
sudo chmod -R 755 /var/lib/docker/pooled-storage

# 2. Copy docker-compose.yml to your Pi
# 3. Run the application
docker-compose up -d --build

# 4. Access the dashboard
# Open: http://192.168.100.14:20050
```

## Usage Guide

### 1. Adding Accounts

**Method A: OAuth Token**
```bash
# On Windows PowerShell
rclone authorize drive  # For Google Drive
rclone authorize onedrive  # For OneDrive
```
Copy the JSON token and paste in dashboard.

**Method B: Service Account (Google)**
Upload your service account JSON file.

**Method C: Remote Authentication**
```bash
docker exec -it pooled-storage-manager rclone config
```

### 2. Creating Storage Pools

1. Navigate to "Storage Pools"
2. Click "Create Pool"
3. Configure settings
4. Add accounts to the pool

### 3. Mounting in OpenMediaVault

1. Start your pool
2. Note the mount URL (e.g., `webdav://192.168.100.14:20060`)
3. In OMV: Storage → File Systems → Add Remote Share
4. Enter connection details and mount

## Configuration

- **API Port**: 20050
- **Mount Ports**: 20060-20100
- **Config**: `/var/lib/docker/pooled-storage/config`
- **Data**: `/var/lib/docker/pooled-storage/data`

## License

MIT
