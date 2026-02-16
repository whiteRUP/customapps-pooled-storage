# Pooled Storage Manager - User Guide

## Overview

Pooled Storage Manager allows you to combine multiple Google Drive and Microsoft OneDrive accounts into a single large storage pool. Files can be spread across all accounts, giving you virtually unlimited storage.

## Features

### 🔐 Authentication
- **OAuth Flow**: Secure login with Google/Microsoft (recommended)
- **Manual Token**: Add accounts using access tokens

### 📊 Storage Strategies
- **Union**: Spreads files across all drives
- **Most Free Space**: Puts new files on drive with most free space
- **First Drive First**: Fills first drive before moving to next
- **Mirror**: Copies files to all drives for redundancy

### 🔧 Advanced Features
- **Chunker**: Split large files into chunks across multiple drives
- **Large File Support**: Store files bigger than any single drive
- **Real-time Stats**: Monitor usage across all accounts
- **Dynamic Management**: Add/remove accounts from pools without remounting

## Getting Started

### 1. Add Cloud Accounts

**Option A: OAuth (Recommended)**
1. Go to Accounts page
2. Click "Add Account"
3. Choose "OAuth Login" tab
4. Click "Login with Google" or "Login with Microsoft"
5. Authorize access in the popup window
6. Account will be added automatically

**Option B: Manual Token**
1. Go to Accounts page
2. Click "Add Account"
3. Choose "Manual Token" tab
4. Fill in:
   - Name: e.g., "My Google Drive"
   - Type: Google or Microsoft
   - Email: Your account email
   - Access Token: Get from OAuth playground or rclone
5. Click "Add Account"

### 2. Create Storage Pool

1. Go to Storage Pools page
2. Click "Create Pool"
3. Configure your pool:
   - **Name**: Give it a descriptive name
   - **Strategy**: Choose pooling strategy
   - **Enable Chunker**: Turn on to split large files
     - Chunk Size: e.g., "100M" for 100MB chunks
   - **Allow Large Files**: Enable to store files larger than single drive
   - **Select Accounts**: Check accounts to include
4. Click "Create Pool"

### 3. Start the Pool

1. Find your pool in the list
2. Click the Play button (▶️)
3. Wait for status to change to "running"
4. Note the mount path shown in the card

### 4. Access Your Storage

The pool is now mounted at: `/mnt/pooled-storage/[pool-id]`

You can access it:
- Directly on the host: `cd /mnt/pooled-storage/[pool-id]`
- Via SMB/NFS after sharing in OpenMediaVault
- Any application that can access local filesystems

## Usage Examples

### Example 1: Basic Pool (2 Accounts, Union Strategy)
Perfect for: Spreading files across drives for maximum space

Setup:
- Accounts: 2x 15GB Google Drive
- Strategy: Union
- Chunker: Disabled
- Result: 30GB total, files spread across both drives

### Example 2: Large File Pool (3 Accounts, with Chunker)
Perfect for: Storing large video files bigger than single drive

Setup:
- Accounts: 3x 15GB Google Drive
- Strategy: Union
- Chunker: Enabled (100M chunks)
- Allow Large Files: Enabled
- Result: Can store files up to 45GB (or larger with chunking)

### Example 3: Redundant Pool (2 Accounts, Mirror)
Perfect for: Important files that need backup

Setup:
- Accounts: 2x 15GB Google Drive
- Strategy: Mirror
- Result: Files copied to both drives, 15GB usable space

### Example 4: Mixed Provider Pool
Perfect for: Using all your cloud storage

Setup:
- Accounts: 2x Google Drive + 2x OneDrive
- Strategy: Most Free Space
- Result: Files automatically go to drive with most space

## Best Practices

### Security
- Use OAuth instead of manual tokens when possible
- Don't share OAuth credentials
- Regularly rotate access tokens
- Use strong passwords

### Performance
- More accounts = better performance for large files
- Enable chunker for files >100MB
- Monitor account quotas to avoid hitting limits
- Refresh account stats regularly

### Reliability
- Don't delete accounts that are part of running pools
- Stop pools before removing accounts
- Keep at least 10% free space on each account
- Monitor pool status regularly

### OpenMediaVault Integration
1. Create and start a pool
2. Note the mount path
3. In OMV: Storage → Shared Folders → Add
4. Point to `/mnt/pooled-storage/[pool-id]`
5. Configure SMB/NFS as needed
6. Access from any device on network

## Monitoring

### Dashboard
- **Total Capacity**: Combined space from all accounts
- **Used Space**: How much you've stored
- **Free Space**: Available storage
- **Usage Graph**: Visual representation
- **Account Status**: Individual account health
- **Pool Status**: Running/stopped pools

### Account Stats
- Quota per account
- Usage percentage
- Status (active/inactive/error)
- Last updated time

### Pool Stats
- Total capacity of pool
- Number of accounts
- Mount status
- Current strategy

## Troubleshooting

### Account shows "error" status
- Refresh the account quota
- Check if token is still valid
- Re-authenticate via OAuth
- Check account hasn't been locked

### Pool won't start
- Verify all accounts are active
- Check if mount path exists
- Review backend logs: `docker logs pooled-storage-backend`
- Ensure FUSE is available

### Files not appearing
- Check pool is running
- Verify mount path is correct
- Try stopping and restarting pool
- Check rclone logs in container

### Slow performance
- Reduce chunk size for faster transfers
- Use "Most Free Space" strategy
- Add more accounts to pool
- Check network speed to cloud providers

### Can't access from OMV
- Verify pool is running
- Check mount path in OMV is correct
- Ensure permissions are set correctly
- Try remounting in OMV

## Advanced Configuration

### Chunk Sizes
- Small files: No chunker needed
- Medium files (100MB-1GB): 100M chunks
- Large files (1GB-10GB): 500M chunks
- Huge files (10GB+): 1G chunks

### Strategy Selection
Choose based on your needs:
- **Union**: Best for general use
- **Most Free Space**: Best for balanced usage
- **First Drive First**: Best for sequential filling
- **Mirror**: Best for important data

### Adding Accounts to Running Pool
1. Stop the pool
2. Go to pool details
3. Add new account
4. Restart the pool

### Removing Accounts
⚠️ **Warning**: Only remove accounts that don't have files!
1. Stop the pool
2. Move files from account to others
3. Remove account from pool
4. Delete account if desired

## API Reference

For developers wanting to integrate:

Base URL: `http://192.168.100.14:20080/api`

Endpoints:
- `GET /accounts` - List accounts
- `POST /accounts` - Add account
- `GET /pools` - List pools
- `POST /pools` - Create pool
- `POST /pools/:id/start` - Start pool
- `POST /pools/:id/stop` - Stop pool
- `GET /stats` - Get statistics

See API documentation in code for full reference.

## FAQ

**Q: Can I use the same account in multiple pools?**
A: Yes, but be careful about storage limits.

**Q: What happens if I delete an account with files?**
A: Files will be lost! Always migrate data first.

**Q: Can I change pool strategy after creation?**
A: No, you need to create a new pool.

**Q: How much overhead does chunking add?**
A: Minimal - about 1-2% for metadata.

**Q: Can I access pools from multiple devices?**
A: Yes, via SMB/NFS sharing from OpenMediaVault.

**Q: Is this secure?**
A: Yes, OAuth tokens are stored securely, not transmitted in logs.

**Q: Can I backup the configuration?**
A: Yes, backup `/var/lib/docker/pooled-storage/`

## Support

For issues or questions:
1. Check logs: `docker logs pooled-storage-backend`
2. Review DEPLOYMENT.md for setup help
3. Check GitHub Issues
4. Verify all prerequisites are met

## Updates

To update to latest version:
```bash
cd customapps-pooled-storage
git pull
docker-compose down
docker-compose up -d --build
```
