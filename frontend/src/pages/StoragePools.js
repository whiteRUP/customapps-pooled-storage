import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Card,
  CardContent,
  CardActions,
  Grid,
  Typography,
  Chip,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Checkbox,
  FormGroup,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import AddIcon from '@mui/icons-material/Add';
import { getPools, createPool, deletePool, startPool, stopPool, getAccounts } from '../services/api';

export default function StoragePools() {
  const [pools, setPools] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    strategy: 'union',
    enable_chunker: false,
    allow_large_files: false,
    chunk_size: '100M',
    account_ids: [],
  });

  const loadPools = async () => {
    try {
      const response = await getPools();
      setPools(response.data);
    } catch (error) {
      console.error('Failed to load pools:', error);
    }
  };

  const loadAccounts = async () => {
    try {
      const response = await getAccounts();
      setAccounts(response.data);
    } catch (error) {
      console.error('Failed to load accounts:', error);
    }
  };

  useEffect(() => {
    loadPools();
    loadAccounts();
  }, []);

  const handleOpen = () => setOpen(true);
  const handleClose = () => {
    setOpen(false);
    setFormData({
      name: '',
      strategy: 'union',
      enable_chunker: false,
      allow_large_files: false,
      chunk_size: '100M',
      account_ids: [],
    });
  };

  const handleSubmit = async () => {
    try {
      await createPool(formData);
      await loadPools();
      handleClose();
    } catch (error) {
      console.error('Failed to create pool:', error);
      alert('Failed to create pool');
    }
  };

  const handleStart = async (id) => {
    try {
      await startPool(id);
      await loadPools();
    } catch (error) {
      console.error('Failed to start pool:', error);
      alert('Failed to start pool');
    }
  };

  const handleStop = async (id) => {
    try {
      await stopPool(id);
      await loadPools();
    } catch (error) {
      console.error('Failed to stop pool:', error);
      alert('Failed to stop pool');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this pool?')) {
      try {
        await deletePool(id);
        await loadPools();
      } catch (error) {
        console.error('Failed to delete pool:', error);
      }
    }
  };

  const handleAccountToggle = (accountId) => {
    setFormData((prev) => ({
      ...prev,
      account_ids: prev.account_ids.includes(accountId)
        ? prev.account_ids.filter((id) => id !== accountId)
        : [...prev.account_ids, accountId],
    }));
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Storage Pools</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpen}>
          Create Pool
        </Button>
      </Box>

      <Grid container spacing={3}>
        {pools.map((pool) => (
          <Grid item xs={12} md={6} key={pool.id}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">{pool.name}</Typography>
                  <Chip
                    label={pool.status}
                    color={pool.status === 'running' ? 'success' : 'default'}
                  />
                </Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Strategy: {pool.strategy}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Accounts: {pool.accounts?.length || 0}
                </Typography>
                {pool.enable_chunker && (
                  <Chip label={`Chunker: ${pool.chunk_size}`} size="small" sx={{ mt: 1, mr: 1 }} />
                )}
                {pool.allow_large_files && (
                  <Chip label="Large Files" size="small" sx={{ mt: 1 }} />
                )}
                {pool.mount_path && (
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    Mounted at: {pool.mount_path}
                  </Typography>
                )}
              </CardContent>
              <CardActions>
                {pool.status === 'running' ? (
                  <IconButton onClick={() => handleStop(pool.id)} color="error">
                    <StopIcon />
                  </IconButton>
                ) : (
                  <IconButton onClick={() => handleStart(pool.id)} color="success">
                    <PlayArrowIcon />
                  </IconButton>
                )}
                <IconButton onClick={() => handleDelete(pool.id)} color="error">
                  <DeleteIcon />
                </IconButton>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>Create Storage Pool</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Pool Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            margin="normal"
          />

          <FormControl fullWidth margin="normal">
            <InputLabel>Pooling Strategy</InputLabel>
            <Select
              value={formData.strategy}
              onChange={(e) => setFormData({ ...formData, strategy: e.target.value })}
              label="Pooling Strategy"
            >
              <MenuItem value="union">Union (Spread files across drives)</MenuItem>
              <MenuItem value="eplus">Most Free Space</MenuItem>
              <MenuItem value="epff">First Drive First</MenuItem>
              <MenuItem value="mirror">Mirror (Redundancy)</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={formData.enable_chunker}
                onChange={(e) => setFormData({ ...formData, enable_chunker: e.target.checked })}
              />
            }
            label="Enable Chunker (Split large files)"
          />

          {formData.enable_chunker && (
            <TextField
              fullWidth
              label="Chunk Size"
              value={formData.chunk_size}
              onChange={(e) => setFormData({ ...formData, chunk_size: e.target.value })}
              margin="normal"
              helperText="e.g., 100M, 1G"
            />
          )}

          <FormControlLabel
            control={
              <Switch
                checked={formData.allow_large_files}
                onChange={(e) => setFormData({ ...formData, allow_large_files: e.target.checked })}
              />
            }
            label="Allow files larger than drive size"
          />

          <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>
            Select Accounts
          </Typography>
          <FormGroup>
            {accounts.map((account) => (
              <FormControlLabel
                key={account.id}
                control={
                  <Checkbox
                    checked={formData.account_ids.includes(account.id)}
                    onChange={() => handleAccountToggle(account.id)}
                  />
                }
                label={`${account.name} (${account.email})`}
              />
            ))}
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={!formData.name || formData.account_ids.length === 0}
          >
            Create Pool
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
