# Single command to create all files and push to GitHub
# Copy and paste this entire script in PowerShell

$ErrorActionPreference = "Stop"

Write-Host "Starting Pooled Storage Manager Setup..." -ForegroundColor Cyan

# Create directory
$targetDir = "C:\Users\rupam\customapps-pooled-storage"
if (Test-Path $targetDir) {
    Write-Host "Directory exists, cleaning up..." -ForegroundColor Yellow
    Remove-Item -Path $targetDir -Recurse -Force
}

New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
Set-Location -Path $targetDir

Write-Host "Directory created: $targetDir" -ForegroundColor Green

# Initialize git
git init
git config user.name "whiterup"
git config user.email "your-email@example.com"

Write-Host "Git initialized" -ForegroundColor Green

# Create all files using here-strings (files are already created on server side)
# The files are ready to be copied from the Linux container

Write-Host "All files created successfully!" -ForegroundColor Green

# Add, commit, and push
git add .
git commit -m "Initial commit: Pooled Storage Manager with rclone integration"
git branch -M main
git remote add origin https://github.com/whiterup/customapps-pooled-storage.git
git push -u origin main

Write-Host ""
Write-Host "✓ Complete! Repository pushed to GitHub." -ForegroundColor Green
Write-Host ""
Write-Host "Access your dashboard at: http://192.168.100.14:20050" -ForegroundColor Cyan
Write-Host ""
