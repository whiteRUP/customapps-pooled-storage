# Deployment Guide

## Prerequisites

1. Docker and Docker Compose installed on Raspberry Pi
2. GitHub account configured
3. OpenMediaVault installed (optional)

## Step 1: Push to GitHub

From Windows PowerShell:
```powershell
cd C:\Users\rupam\customapps-pooled-storage
git init
git add .
git commit -m "Initial commit: Pooled Storage Manager"
git branch -M main
git remote add origin https://github.com/whiterup/customapps-pooled-storage.git
git push -u origin main
```

## Step 2: Deploy on Raspberry Pi

1. SSH into your Raspberry Pi:
```bash
ssh pi@192.168.100.14
```

2. Clone the repository:
```bash
git clone https://github.com/whiterup/customapps-pooled-storage.git
cd customapps-pooled-storage
```

3. Create required directories:
```bash
sudo mkdir -p /var/lib/docker/pooled-storage/{data,config,rclone}
sudo mkdir -p /mnt/pooled-storage
sudo chmod -R 755 /var/lib/docker/pooled-storage
sudo chmod -R 755 /mnt/pooled-storage
```

4. Create .env file:
```bash
cp .env.example .env
nano .env
```

Edit the .env file and set your configuration:
- Change JWT_SECRET to a random string
- Change ADMIN_PASSWORD
- Add OAuth credentials if you have them

5. Build and start the containers:
```bash
docker-compose up -d --build
```

6. Check logs:
```bash
docker-compose logs -f
```

## Step 3: Access the Dashboard

Open your browser and go to:
- Frontend: http://192.168.100.14:20081
- Backend API: http://192.168.100.14:20080

## Step 4: Configure OAuth (Optional)

To enable OAuth authentication:

### Google Drive
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google Drive API
4. Create OAuth 2.0 credentials
5. Add redirect URI: `http://192.168.100.14:20080/api/oauth/callback`
6. Copy Client ID and Client Secret
7. Add to .env file and restart containers

### Microsoft OneDrive
1. Go to [Azure Portal](https://portal.azure.com)
2. Register a new application
3. Add redirect URI: `http://192.168.100.14:20080/api/oauth/callback`
4. Create a client secret
5. Add Microsoft Graph API permissions: Files.ReadWrite.All
6. Copy Application (client) ID and Client Secret
7. Add to .env file and restart containers

## Step 5: Mount in OpenMediaVault

After creating and starting a storage pool:

1. Note the mount path (e.g., `/mnt/pooled-storage/pool-id`)
2. In OMV, go to Storage → Shared Folders
3. Click Add and enter:
   - Name: Your pool name
   - Device: Select root filesystem
   - Path: /mnt/pooled-storage/[your-pool-id]
4. Save and apply
5. Configure SMB/NFS sharing as needed

## Troubleshooting

### Container won't start
```bash
docker-compose logs backend
docker-compose logs frontend
```

### Mount fails
Check if FUSE is available:
```bash
ls -la /dev/fuse
```

Check rclone config:
```bash
docker exec pooled-storage-backend rclone config show
```

### Database issues
```bash
docker exec -it pooled-storage-backend sh
ls -la /app/data/
```

## Updating

To update the application:
```bash
cd customapps-pooled-storage
git pull
docker-compose down
docker-compose up -d --build
```

## Backup

Important directories to backup:
- `/var/lib/docker/pooled-storage/data` - Database
- `/var/lib/docker/pooled-storage/config` - Configuration
- `/var/lib/docker/pooled-storage/rclone` - rclone config

```bash
sudo tar -czf pooled-storage-backup.tar.gz /var/lib/docker/pooled-storage
```

## Security Notes

- Change default passwords immediately
- Keep OAuth credentials secure
- Use HTTPS if exposing to internet (not recommended for this setup)
- Regularly update Docker images
- Monitor disk usage on SSD
