# PowerShell script to initialize git repo and push to GitHub
# Run this from Windows PowerShell in C:\Users\rupam\customapps-pooled-storage

Write-Host "Pooled Storage Manager - GitHub Deployment Script" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# Initialize git repository
Write-Host "Initializing Git repository..." -ForegroundColor Yellow
git init

# Add all files
Write-Host "Adding files..." -ForegroundColor Yellow
git add .

# Commit
Write-Host "Creating initial commit..." -ForegroundColor Yellow
git commit -m "Initial commit: Pooled Storage Manager with rclone integration"

# Create GitHub repository and push
Write-Host "Setting up GitHub remote..." -ForegroundColor Yellow
git branch -M main

# Add GitHub remote (replace with your actual repository URL)
$repoUrl = "https://github.com/whiterup/customapps-pooled-storage.git"
git remote add origin $repoUrl

Write-Host ""
Write-Host "Pushing to GitHub..." -ForegroundColor Yellow
git push -u origin main

Write-Host ""
Write-Host "✓ Repository pushed to GitHub successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. SSH into your Raspberry Pi: ssh user@192.168.100.14" -ForegroundColor White
Write-Host "2. Clone the repository: git clone $repoUrl" -ForegroundColor White
Write-Host "3. Navigate to directory: cd customapps-pooled-storage" -ForegroundColor White
Write-Host "4. Create config directories:" -ForegroundColor White
Write-Host "   sudo mkdir -p /var/lib/docker/pooled-storage/config" -ForegroundColor Gray
Write-Host "   sudo mkdir -p /var/lib/docker/pooled-storage/data" -ForegroundColor Gray
Write-Host "   sudo chmod -R 755 /var/lib/docker/pooled-storage" -ForegroundColor Gray
Write-Host "5. Start the application: docker-compose up -d --build" -ForegroundColor White
Write-Host "6. Access dashboard: http://192.168.100.14:20050" -ForegroundColor White
Write-Host ""
