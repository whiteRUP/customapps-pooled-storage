# 🚀 COMPLETE SETUP INSTRUCTIONS

## What You Have

A complete **Pooled Storage Manager** application with:
- ✅ Go backend (lightweight, fast)
- ✅ React frontend (beautiful, professional UI)
- ✅ Docker deployment (easy setup)
- ✅ OAuth support (Google & Microsoft)
- ✅ Multiple pooling strategies
- ✅ File chunking for large files
- ✅ Real-time statistics dashboard
- ✅ OpenMediaVault integration ready

## 📁 Project Structure

```
customapps-pooled-storage/
├── backend/               # Go backend
│   ├── main.go           # Entry point
│   ├── internal/         # Core logic
│   │   ├── api/         # REST API handlers
│   │   ├── models/      # Data models
│   │   ├── services/    # Business logic
│   │   ├── database/    # SQLite database
│   │   └── rclone/      # rclone integration
│   ├── Dockerfile       # Backend container
│   └── go.mod           # Go dependencies
├── frontend/             # React frontend
│   ├── src/
│   │   ├── components/  # Reusable components
│   │   ├── pages/       # Main pages
│   │   └── services/    # API client
│   ├── Dockerfile       # Frontend container
│   └── package.json     # Node dependencies
├── docker-compose.yml    # Docker orchestration
├── deploy.ps1           # Windows setup script
├── DEPLOYMENT.md        # Deployment guide
└── USER_GUIDE.md        # User manual
```

## 🎯 STEP-BY-STEP SETUP

### Step 1: Copy Files to Your Computer

1. Download/copy the entire `customapps-pooled-storage` folder
2. Place it in: `C:\Users\rupam\`
3. Verify you have: `C:\Users\rupam\customapps-pooled-storage`

### Step 2: Create GitHub Repository

1. Go to: https://github.com/new
2. Repository name: `customapps-pooled-storage`
3. Description: "Pooled cloud storage manager using rclone"
4. **DO NOT** initialize with README, .gitignore, or license
5. Click "Create repository"

### Step 3: Push to GitHub (Choose ONE method)

**Method A: Using PowerShell Script (Recommended)**
```powershell
cd C:\Users\rupam\customapps-pooled-storage
.\deploy.ps1
```
Follow the prompts!

**Method B: Quick One-Liner**
```powershell
cd C:\Users\rupam\customapps-pooled-storage; if (-not (Test-Path .git)) { git init }; git config user.name 'whiterup'; git config user.email 'whiterup@users.noreply.github.com'; git add .; git commit -m 'Initial commit: Pooled Storage Manager'; git branch -M main; git remote add origin https://github.com/whiterup/customapps-pooled-storage.git 2>$null; git push -u origin main
```

**Method C: Manual Commands**
```powershell
cd C:\Users\rupam\customapps-pooled-storage
git init
git config user.name "whiterup"
git config user.email "whiterup@users.noreply.github.com"
git add .
git commit -m "Initial commit: Pooled Storage Manager"
git branch -M main
git remote add origin https://github.com/whiterup/customapps-pooled-storage.git
git push -u origin main
```

### Step 4: Deploy on Raspberry Pi

SSH into your Raspberry Pi:
```bash
ssh pi@192.168.100.14
```

Clone and setup:
```bash
# Clone repository
git clone https://github.com/whiterup/customapps-pooled-storage.git
cd customapps-pooled-storage

# Create directories
sudo mkdir -p /var/lib/docker/pooled-storage/{data,config,rclone}
sudo mkdir -p /mnt/pooled-storage
sudo chmod -R 755 /var/lib/docker/pooled-storage
sudo chmod -R 755 /mnt/pooled-storage

# Create environment file
cp .env.example .env
nano .env
```

Edit `.env` file:
```bash
# Change these values:
JWT_SECRET=your-random-secret-here-make-it-long-and-complex
ADMIN_PASSWORD=your-secure-password-here

# Optional: Add OAuth credentials
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
```

Build and start:
```bash
docker-compose up -d --build
```

Check status:
```bash
docker-compose ps
docker-compose logs -f
```

### Step 5: Access Your Dashboard

Open browser and go to:
- **Dashboard**: http://192.168.100.14:20081
- **API**: http://192.168.100.14:20080/api/health

## 🎨 Using the Dashboard

### Add Your First Account

1. Go to **Accounts** page
2. Click **"Add Account"**
3. Choose **OAuth Login** or **Manual Token**
4. For OAuth:
   - Click "Login with Google" or "Login with Microsoft"
   - Authorize in popup window
5. For Manual:
   - Enter name, email, and access token
   - Click "Add Account"

### Create Your First Pool

1. Go to **Storage Pools** page
2. Click **"Create Pool"**
3. Configure:
   - Name: e.g., "My Main Storage"
   - Strategy: "Union" (recommended for most users)
   - Enable Chunker: ON (if you want to split large files)
   - Chunk Size: "100M" (100MB chunks)
   - Select your accounts
4. Click **"Create Pool"**
5. Click the **Play button** (▶️) to start it

### Mount in OpenMediaVault

After pool is running:
1. Note the mount path: `/mnt/pooled-storage/[pool-id]`
2. In OMV: **Storage → Shared Folders → Add**
3. Settings:
   - Name: Your pool name
   - Device: Select root filesystem
   - Path: `/mnt/pooled-storage/[your-pool-id]`
4. Save and configure SMB/NFS sharing

## 🔧 OAuth Setup (Optional but Recommended)

### For Google Drive

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project or select existing
3. Enable **Google Drive API**
4. Go to **Credentials → Create Credentials → OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Add redirect URI: `http://192.168.100.14:20080/api/oauth/callback`
7. Copy **Client ID** and **Client Secret**
8. Add to `.env` file on Raspberry Pi:
   ```
   GOOGLE_CLIENT_ID=your-client-id-here
   GOOGLE_CLIENT_SECRET=your-client-secret-here
   ```
9. Restart: `docker-compose restart`

### For Microsoft OneDrive

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory → App registrations**
3. Click **New registration**
4. Name: "Pooled Storage Manager"
5. Add redirect URI: `http://192.168.100.14:20080/api/oauth/callback`
6. After creation, go to **Certificates & secrets**
7. Create new **Client secret**
8. Go to **API permissions**
9. Add **Microsoft Graph → Files.ReadWrite.All** (Delegated)
10. Copy **Application (client) ID** and **Client secret value**
11. Add to `.env` file:
    ```
    MICROSOFT_CLIENT_ID=your-client-id-here
    MICROSOFT_CLIENT_SECRET=your-client-secret-here
    ```
12. Restart: `docker-compose restart`

## 📊 Port Reference

- **20080**: Backend API
- **20081**: Frontend Dashboard  
- **8080**: Backend internal (container only)
- **80**: Frontend internal (container only)

## 🔍 Troubleshooting

### "Cannot connect to backend"
```bash
docker-compose logs backend
```
Check if backend is running and no errors

### "Pool won't start"
```bash
docker exec pooled-storage-backend rclone version
docker exec pooled-storage-backend ls -la /mnt/pooled-storage
```
Verify rclone and mount directory exist

### "Account shows error"
1. Go to Accounts page
2. Click refresh button
3. If still error, delete and re-add account

### Container won't start
```bash
docker-compose down
docker-compose up -d --build
```

### Need to reset everything
```bash
docker-compose down -v
sudo rm -rf /var/lib/docker/pooled-storage/*
docker-compose up -d --build
```

## 📚 Documentation Files

- **README.md**: Project overview
- **DEPLOYMENT.md**: Detailed deployment guide
- **USER_GUIDE.md**: Complete user manual with examples
- **QUICK_DEPLOY.txt**: One-liner deployment command

## 🎯 Quick Tips

1. **Start Simple**: Add 2 accounts, create 1 pool with Union strategy
2. **Test First**: Upload a small file to verify everything works
3. **Monitor**: Check Dashboard regularly for quota usage
4. **OAuth is Better**: Use OAuth instead of manual tokens when possible
5. **Backup Config**: Backup `/var/lib/docker/pooled-storage/` regularly

## 🆘 Getting Help

1. Check logs: `docker-compose logs -f`
2. Review USER_GUIDE.md for usage examples
3. Check DEPLOYMENT.md for setup issues
4. Verify all prerequisites are installed

## ✅ Success Checklist

- [ ] Files copied to C:\Users\rupam\customapps-pooled-storage
- [ ] GitHub repository created
- [ ] Code pushed to GitHub
- [ ] Cloned on Raspberry Pi
- [ ] Directories created with correct permissions
- [ ] .env file configured
- [ ] Docker containers running
- [ ] Can access dashboard at http://192.168.100.14:20081
- [ ] Account added successfully
- [ ] Pool created and started
- [ ] Can see files in /mnt/pooled-storage/[pool-id]
- [ ] (Optional) Shared in OpenMediaVault

## 🎉 You're Done!

Your pooled storage system is now ready to use. Enjoy your unlimited cloud storage!

---

**Need help?** Check the documentation files or review the logs.
**Want to contribute?** Fork the repository and submit pull requests!
