#!/bin/bash
# All-in-one setup script for Pooled Storage Manager
# This script will be executed to copy files to Windows and push to GitHub

echo "=================================="
echo "Pooled Storage Manager Setup"
echo "=================================="
echo ""

# Source directory
SRC_DIR="/home/claude/customapps-pooled-storage"

# Target directory (Windows format)
TARGET_DIR="/mnt/c/Users/rupam/customapps-pooled-storage"

# Check if source exists
if [ ! -d "$SRC_DIR" ]; then
    echo "Error: Source directory not found!"
    exit 1
fi

# Create target directory
echo "Creating target directory..."
mkdir -p "$TARGET_DIR"

# Copy all files
echo "Copying files..."
cp -r "$SRC_DIR"/* "$TARGET_DIR/"
cp "$SRC_DIR"/.gitignore "$TARGET_DIR/" 2>/dev/null || true

echo "Files copied successfully!"
echo ""

# Create a Windows batch script to push to GitHub
cat > "$TARGET_DIR/push-to-github.bat" << 'EOF'
@echo off
echo ====================================
echo Pushing to GitHub
echo ====================================
echo.

cd /d C:\Users\rupam\customapps-pooled-storage

git init
git add .
git commit -m "Initial commit: Pooled Storage Manager"
git branch -M main
git remote add origin https://github.com/whiterup/customapps-pooled-storage.git
git push -u origin main

echo.
echo ====================================
echo Done! Repository pushed to GitHub
echo ====================================
echo.
echo Next steps:
echo 1. SSH to your Raspberry Pi
echo 2. Clone: git clone https://github.com/whiterup/customapps-pooled-storage.git
echo 3. Create directories: sudo mkdir -p /var/lib/docker/pooled-storage/{config,data}
echo 4. Deploy: docker-compose up -d --build
echo 5. Access: http://192.168.100.14:20050
echo.
pause
EOF

echo "Setup complete!"
echo ""
echo "Run this command in Windows PowerShell:"
echo "C:\\Users\\rupam\\customapps-pooled-storage\\push-to-github.bat"
echo ""
