import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Divider,
  Alert,
} from '@mui/material';
import { getSystemSettings, getOAuthSettings } from '../services/api';

export default function Settings() {
  const [systemSettings, setSystemSettings] = useState(null);
  const [oauthSettings, setOauthSettings] = useState(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [system, oauth] = await Promise.all([
          getSystemSettings(),
          getOAuthSettings(),
        ]);
        setSystemSettings(system.data);
        setOauthSettings(oauth.data);
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };
    loadSettings();
  }, []);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          System Information
        </Typography>
        <Divider sx={{ mb: 2 }} />
        
        <TextField
          fullWidth
          label="Host IP"
          value={systemSettings?.host_ip || ''}
          margin="normal"
          disabled
        />
        <TextField
          fullWidth
          label="Mount Path"
          value={systemSettings?.mount_path || ''}
          margin="normal"
          disabled
        />
        <TextField
          fullWidth
          label="Version"
          value={systemSettings?.version || ''}
          margin="normal"
          disabled
        />
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          OAuth Configuration
        </Typography>
        <Divider sx={{ mb: 2 }} />
        
        <Alert severity="info" sx={{ mb: 2 }}>
          OAuth credentials should be configured via environment variables or the .env file.
        </Alert>

        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Google Drive
          </Typography>
          <Alert severity={oauthSettings?.google?.configured ? 'success' : 'warning'}>
            {oauthSettings?.google?.configured 
              ? 'Google OAuth is configured' 
              : 'Google OAuth is not configured'}
          </Alert>
        </Box>

        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Microsoft OneDrive
          </Typography>
          <Alert severity={oauthSettings?.microsoft?.configured ? 'success' : 'warning'}>
            {oauthSettings?.microsoft?.configured 
              ? 'Microsoft OAuth is configured' 
              : 'Microsoft OAuth is not configured'}
          </Alert>
        </Box>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Mount Instructions for OpenMediaVault
        </Typography>
        <Divider sx={{ mb: 2 }} />
        
        <Alert severity="info" sx={{ mb: 2 }}>
          To share pooled storage in OpenMediaVault:
        </Alert>

        <Typography variant="body2" paragraph>
          1. Create a storage pool and start it
        </Typography>
        <Typography variant="body2" paragraph>
          2. In OMV, go to Storage → Shared Folders
        </Typography>
        <Typography variant="body2" paragraph>
          3. Add a new shared folder pointing to: /mnt/pooled-storage/[pool-id]
        </Typography>
        <Typography variant="body2" paragraph>
          4. Configure SMB/NFS sharing as needed
        </Typography>
      </Paper>
    </Box>
  );
}
