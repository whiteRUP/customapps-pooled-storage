import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://192.168.100.14:20080';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Accounts
export const getAccounts = () => api.get('/accounts');
export const getAccount = (id) => api.get(`/accounts/${id}`);
export const createAccount = (data) => api.post('/accounts', data);
export const deleteAccount = (id) => api.delete(`/accounts/${id}`);
export const refreshAccount = (id) => api.post(`/accounts/${id}/refresh`);
export const updateAccountStatus = (id, status) => api.put(`/accounts/${id}/status`, { status });

// Storage Pools
export const getPools = () => api.get('/pools');
export const getPool = (id) => api.get(`/pools/${id}`);
export const createPool = (data) => api.post('/pools', data);
export const deletePool = (id) => api.delete(`/pools/${id}`);
export const startPool = (id) => api.post(`/pools/${id}/start`);
export const stopPool = (id) => api.post(`/pools/${id}/stop`);
export const addAccountToPool = (poolId, accountId) => 
  api.post(`/pools/${poolId}/accounts`, { account_id: accountId });
export const removeAccountFromPool = (poolId, accountId) => 
  api.delete(`/pools/${poolId}/accounts/${accountId}`);

// Stats
export const getStats = () => api.get('/stats');
export const getAccountStats = () => api.get('/stats/accounts');
export const getPoolStats = () => api.get('/stats/pools');
export const refreshStats = () => api.post('/stats/refresh');

// OAuth
export const startOAuth = (provider) => api.post('/oauth/start', { provider });
export const oauthCallback = (data) => api.post('/oauth/callback', data);
export const getOAuthStatus = () => api.get('/oauth/test');

// Settings
export const getOAuthSettings = () => api.get('/settings/oauth');
export const getSystemSettings = () => api.get('/settings/system');

// Health
export const checkHealth = () => api.get('/health');

export default api;
