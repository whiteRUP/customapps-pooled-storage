import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import { getAccounts, createAccount, deleteAccount, refreshAccount, startOAuth } from '../services/api';

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [open, setOpen] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    type: 'google',
    email: '',
    token: '',
  });

  const loadAccounts = async () => {
    try {
      const response = await getAccounts();
      setAccounts(response.data);
    } catch (error) {
      console.error('Failed to load accounts:', error);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleOpen = () => setOpen(true);
  const handleClose = () => {
    setOpen(false);
    setFormData({ name: '', type: 'google', email: '', token: '' });
  };

  const handleOAuthLogin = async (provider) => {
    try {
      const response = await startOAuth(provider);
      window.open(response.data.url, '_blank', 'width=600,height=700');
      
      // Listen for OAuth completion
      window.addEventListener('message', async (event) => {
        if (event.data.type === 'oauth-success') {
          await loadAccounts();
          handleClose();
        }
      });
    } catch (error) {
      console.error('OAuth error:', error);
      alert('Failed to start OAuth flow');
    }
  };

  const handleManualSubmit = async () => {
    try {
      await createAccount(formData);
      await loadAccounts();
      handleClose();
    } catch (error) {
      console.error('Failed to create account:', error);
      alert('Failed to create account');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this account?')) {
      try {
        await deleteAccount(id);
        await loadAccounts();
      } catch (error) {
        console.error('Failed to delete account:', error);
      }
    }
  };

  const handleRefresh = async (id) => {
    try {
      await refreshAccount(id);
      await loadAccounts();
    } catch (error) {
      console.error('Failed to refresh account:', error);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Cloud Accounts</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpen}>
          Add Account
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Capacity</TableCell>
              <TableCell>Used</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {accounts.map((account) => (
              <TableRow key={account.id}>
                <TableCell>{account.name}</TableCell>
                <TableCell>
                  <Chip
                    label={account.type}
                    color={account.type === 'google' ? 'primary' : 'secondary'}
                    size="small"
                  />
                </TableCell>
                <TableCell>{account.email}</TableCell>
                <TableCell>{formatBytes(account.quota_total)}</TableCell>
                <TableCell>{formatBytes(account.quota_used)}</TableCell>
                <TableCell>
                  <Chip
                    label={account.status}
                    color={account.status === 'active' ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell align="right">
                  <IconButton onClick={() => handleRefresh(account.id)} size="small">
                    <RefreshIcon />
                  </IconButton>
                  <IconButton onClick={() => handleDelete(account.id)} size="small" color="error">
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>Add Cloud Account</DialogTitle>
        <DialogContent>
          <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ mb: 2 }}>
            <Tab label="OAuth Login" />
            <Tab label="Manual Token" />
          </Tabs>

          {tabValue === 0 && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Authenticate with your cloud provider using OAuth
              </Typography>
              <Box display="flex" gap={2}>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={() => handleOAuthLogin('google')}
                >
                  Login with Google
                </Button>
                <Button
                  variant="contained"
                  color="secondary"
                  fullWidth
                  onClick={() => handleOAuthLogin('microsoft')}
                >
                  Login with Microsoft
                </Button>
              </Box>
            </Box>
          )}

          {tabValue === 1 && (
            <Box sx={{ pt: 2 }}>
              <TextField
                fullWidth
                label="Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                margin="normal"
              />
              <FormControl fullWidth margin="normal">
                <InputLabel>Type</InputLabel>
                <Select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  label="Type"
                >
                  <MenuItem value="google">Google Drive</MenuItem>
                  <MenuItem value="microsoft">Microsoft OneDrive</MenuItem>
                </Select>
              </FormControl>
              <TextField
                fullWidth
                label="Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                margin="normal"
              />
              <TextField
                fullWidth
                label="Access Token"
                value={formData.token}
                onChange={(e) => setFormData({ ...formData, token: e.target.value })}
                margin="normal"
                multiline
                rows={3}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          {tabValue === 1 && (
            <Button onClick={handleManualSubmit} variant="contained">
              Add Account
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
