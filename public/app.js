// API Configuration
const API_BASE = window.location.origin;
let ws = null;
let currentPool = null;
let activityLog = [];

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupNavigation();
    setupWebSocket();
    setupForms();
});

async function initializeApp() {
    await loadDashboard();
    await loadPools();
    await loadAccounts();
    await loadSystemStatus();
    
    // Auto-refresh every 30 seconds
    setInterval(() => {
        if (document.querySelector('#dashboard-view').classList.contains('active')) {
            loadDashboard();
        }
    }, 30000);
}

// Navigation
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Update active nav
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            
            // Switch view
            const view = item.dataset.view;
            switchView(view);
        });
    });
}

function switchView(viewName) {
    // Hide all views
    document.querySelectorAll('.view-content').forEach(v => {
        v.classList.remove('active');
    });
    
    // Show selected view
    document.getElementById(`${viewName}-view`).classList.add('active');
    
    // Update title
    const titles = {
        'dashboard': 'Dashboard',
        'pools': 'Storage Pools',
        'accounts': 'Accounts',
        'settings': 'Settings'
    };
    document.getElementById('view-title').textContent = titles[viewName] || viewName;
    
    // Load data for view
    if (viewName === 'pools') loadPools();
    if (viewName === 'accounts') loadAccounts();
}

// WebSocket
function setupWebSocket() {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${wsProtocol}//${window.location.host}`);
    
    ws.onopen = () => {
        console.log('WebSocket connected');
        addActivity('Connected to server', 'success');
    };
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
    };
    
    ws.onclose = () => {
        console.log('WebSocket disconnected');
        addActivity('Disconnected from server', 'warning');
        // Reconnect after 5 seconds
        setTimeout(setupWebSocket, 5000);
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
}

function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'pool_created':
        case 'pool_updated':
        case 'pool_deleted':
            loadPools();
            loadDashboard();
            addActivity(`Pool ${data.type.split('_')[1]}: ${data.pool?.name || data.poolId}`, 'info');
            break;
        case 'account_added':
        case 'account_deleted':
            loadAccounts();
            loadDashboard();
            addActivity(`Account ${data.type.split('_')[1]}: ${data.account?.name || data.accountId}`, 'info');
            break;
        case 'pool_started':
            loadPools();
            loadDashboard();
            addActivity(`Pool started: ${data.pool.name} on port ${data.pool.mountPort}`, 'success');
            break;
        case 'pool_stopped':
            loadPools();
            loadDashboard();
            addActivity(`Pool stopped`, 'warning');
            break;
        case 'pool_log':
            console.log('Pool log:', data.message);
            break;
        case 'stats_updated':
            loadAccounts();
            break;
    }
}

// API Calls
async function apiCall(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    if (body) {
        options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Request failed');
    }
    
    return response.json();
}

// Dashboard
async function loadDashboard() {
    try {
        const [pools, accounts, status] = await Promise.all([
            apiCall('/api/pools'),
            apiCall('/api/accounts'),
            apiCall('/api/status')
        ]);
        
        // Update stats
        document.getElementById('total-pools').textContent = pools.length;
        document.getElementById('active-pools').textContent = pools.filter(p => p.status === 'active').length;
        document.getElementById('total-accounts').textContent = accounts.length;
        document.getElementById('active-pools-count').textContent = pools.filter(p => p.status === 'active').length;
        document.getElementById('accounts-count').textContent = accounts.length;
        
        // Update active pools list
        const activePoolsList = document.getElementById('active-pools-list');
        const activePools = pools.filter(p => p.status === 'active');
        
        if (activePools.length === 0) {
            activePoolsList.innerHTML = '<p class="empty-state">No active pools</p>';
        } else {
            activePoolsList.innerHTML = activePools.map(pool => `
                <div class="pool-card" onclick="showPoolDetails('${pool.id}')">
                    <div class="pool-header">
                        <div class="pool-title">
                            <i class="fas fa-database"></i>
                            <h4>${pool.name}</h4>
                        </div>
                        <span class="pool-badge badge-active">Active</span>
                    </div>
                    <div class="pool-info">
                        <div class="info-row">
                            <label>Protocol:</label>
                            <span>${pool.serveProtocol?.toUpperCase()}</span>
                        </div>
                        <div class="info-row">
                            <label>Port:</label>
                            <span>${pool.mountPort}</span>
                        </div>
                        <div class="info-row">
                            <label>Accounts:</label>
                            <span>${pool.accounts.length}</span>
                        </div>
                    </div>
                </div>
            `).join('');
        }
        
        // Calculate total storage
        let totalGB = 0;
        accounts.forEach(acc => {
            if (acc.usage && acc.usage.total) {
                const match = acc.usage.total.match(/(\d+\.?\d*)\s*([KMGT]?B)/i);
                if (match) {
                    let size = parseFloat(match[1]);
                    const unit = match[2].toUpperCase();
                    if (unit.includes('T')) size *= 1024;
                    else if (unit.includes('M')) size /= 1024;
                    else if (unit.includes('K')) size /= (1024 * 1024);
                    totalGB += size;
                }
            }
        });
        document.getElementById('total-storage').textContent = `${totalGB.toFixed(0)} GB`;
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showNotification('Error loading dashboard', 'error');
    }
}

// Pools
async function loadPools() {
    try {
        const pools = await apiCall('/api/pools');
        const poolsList = document.getElementById('pools-list');
        
        if (pools.length === 0) {
            poolsList.innerHTML = '<p class="empty-state">No pools created yet</p>';
            return;
        }
        
        poolsList.innerHTML = pools.map(pool => `
            <div class="pool-card" onclick="showPoolDetails('${pool.id}')">
                <div class="pool-header">
                    <div class="pool-title">
                        <i class="fas fa-database"></i>
                        <h4>${pool.name}</h4>
                    </div>
                    <span class="pool-badge ${pool.status === 'active' ? 'badge-active' : 'badge-inactive'}">
                        ${pool.status}
                    </span>
                </div>
                <div class="pool-info">
                    ${pool.description ? `<p style="color: var(--text-muted); margin-bottom: 12px;">${pool.description}</p>` : ''}
                    <div class="info-row">
                        <label>Accounts:</label>
                        <span>${pool.accounts.length}</span>
                    </div>
                    <div class="info-row">
                        <label>Protocol:</label>
                        <span>${pool.serveProtocol?.toUpperCase() || 'WebDAV'}</span>
                    </div>
                    <div class="info-row">
                        <label>Chunker:</label>
                        <span>${pool.enableChunker ? `Enabled (${pool.chunkSize})` : 'Disabled'}</span>
                    </div>
                    ${pool.mountPort ? `
                    <div class="info-row">
                        <label>Port:</label>
                        <span>${pool.mountPort}</span>
                    </div>
                    ` : ''}
                </div>
                <div class="pool-actions">
                    ${pool.status === 'inactive' ? 
                        `<button class="btn btn-success btn-small" onclick="event.stopPropagation(); startPool('${pool.id}')">
                            <i class="fas fa-play"></i> Start
                        </button>` :
                        `<button class="btn btn-danger btn-small" onclick="event.stopPropagation(); stopPool('${pool.id}')">
                            <i class="fas fa-stop"></i> Stop
                        </button>`
                    }
                    <button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); showPoolDetails('${pool.id}')">
                        <i class="fas fa-info-circle"></i> Details
                    </button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading pools:', error);
        showNotification('Error loading pools', 'error');
    }
}

async function startPool(poolId) {
    try {
        showNotification('Starting pool...', 'info');
        const result = await apiCall(`/api/pools/${poolId}/start`, 'POST');
        showNotification(`Pool started on port ${result.mountInfo.port}`, 'success');
        await loadPools();
        await loadDashboard();
    } catch (error) {
        console.error('Error starting pool:', error);
        showNotification(error.message, 'error');
    }
}

async function stopPool(poolId) {
    try {
        showNotification('Stopping pool...', 'info');
        await apiCall(`/api/pools/${poolId}/stop`, 'POST');
        showNotification('Pool stopped', 'success');
        await loadPools();
        await loadDashboard();
    } catch (error) {
        console.error('Error stopping pool:', error);
        showNotification(error.message, 'error');
    }
}

async function deletePool(poolId) {
    if (!confirm('Are you sure you want to delete this pool?')) return;
    
    try {
        await apiCall(`/api/pools/${poolId}`, 'DELETE');
        showNotification('Pool deleted', 'success');
        closeModal('pool-details-modal');
        await loadPools();
        await loadDashboard();
    } catch (error) {
        console.error('Error deleting pool:', error);
        showNotification(error.message, 'error');
    }
}

async function showPoolDetails(poolId) {
    try {
        const [pool, accounts, stats] = await Promise.all([
            apiCall(`/api/pools/${poolId}`),
            apiCall('/api/accounts'),
            apiCall(`/api/pools/${poolId}/stats`)
        ]);
        
        currentPool = pool;
        const poolAccounts = accounts.filter(a => pool.accounts.includes(a.id));
        const availableAccounts = accounts.filter(a => !pool.accounts.includes(a.id));
        
        document.getElementById('pool-details-title').textContent = pool.name;
        document.getElementById('pool-details-content').innerHTML = `
            <div class="pool-details">
                <div class="info-grid" style="margin-bottom: 24px;">
                    <div class="info-item">
                        <label>Status:</label>
                        <span class="pool-badge ${pool.status === 'active' ? 'badge-active' : 'badge-inactive'}">
                            ${pool.status}
                        </span>
                    </div>
                    <div class="info-item">
                        <label>Protocol:</label>
                        <span>${pool.serveProtocol?.toUpperCase() || 'WebDAV'}</span>
                    </div>
                    ${pool.mountPort ? `
                    <div class="info-item">
                        <label>Mount URL:</label>
                        <span><code>${pool.serveProtocol}://192.168.100.14:${pool.mountPort}</code></span>
                    </div>
                    ` : ''}
                    <div class="info-item">
                        <label>Chunker:</label>
                        <span>${pool.enableChunker ? `Enabled (${pool.chunkSize})` : 'Disabled'}</span>
                    </div>
                    <div class="info-item">
                        <label>Split Large Files:</label>
                        <span>${pool.allowSplitFiles ? 'Yes' : 'No'}</span>
                    </div>
                </div>
                
                <h4 style="margin-bottom: 16px;">Accounts in Pool (${poolAccounts.length})</h4>
                ${poolAccounts.length === 0 ? 
                    '<p class="empty-state" style="padding: 24px;">No accounts in this pool</p>' :
                    `<div class="accounts-grid" style="margin-bottom: 24px;">
                        ${poolAccounts.map(acc => `
                            <div class="account-card">
                                <div class="account-header">
                                    <div class="account-title">
                                        <i class="fas fa-${acc.type === 'google' ? 'google' : 'microsoft'}"></i>
                                        <h4>${acc.name}</h4>
                                    </div>
                                </div>
                                <div class="account-info">
                                    <div class="info-row">
                                        <label>Type:</label>
                                        <span>${acc.type}</span>
                                    </div>
                                    <div class="info-row">
                                        <label>Auth Method:</label>
                                        <span>${acc.authMethod}</span>
                                    </div>
                                    ${acc.usage && acc.usage.used ? `
                                    <div class="info-row">
                                        <label>Used:</label>
                                        <span>${acc.usage.used}</span>
                                    </div>
                                    <div class="info-row">
                                        <label>Free:</label>
                                        <span>${acc.usage.free || 'N/A'}</span>
                                    </div>
                                    ` : ''}
                                </div>
                                <div class="account-actions">
                                    <button class="btn btn-danger btn-small" onclick="removeAccountFromPool('${pool.id}', '${acc.id}')">
                                        <i class="fas fa-trash"></i> Remove
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>`
                }
                
                ${availableAccounts.length > 0 ? `
                    <h4 style="margin-bottom: 16px;">Add Accounts to Pool</h4>
                    <div class="form-group">
                        <select id="add-account-select" class="form-control">
                            <option value="">Select an account...</option>
                            ${availableAccounts.map(acc => `
                                <option value="${acc.id}">${acc.name} (${acc.type})</option>
                            `).join('')}
                        </select>
                    </div>
                    <button class="btn btn-primary" onclick="addAccountToPool()">
                        <i class="fas fa-plus"></i> Add Account
                    </button>
                ` : ''}
                
                <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid var(--border-color); display: flex; gap: 12px;">
                    ${pool.status === 'inactive' ? 
                        `<button class="btn btn-success" onclick="startPool('${pool.id}')">
                            <i class="fas fa-play"></i> Start Pool
                        </button>` :
                        `<button class="btn btn-danger" onclick="stopPool('${pool.id}')">
                            <i class="fas fa-stop"></i> Stop Pool
                        </button>`
                    }
                    <button class="btn btn-danger" onclick="deletePool('${pool.id}')">
                        <i class="fas fa-trash"></i> Delete Pool
                    </button>
                    <button class="btn btn-secondary" onclick="closeModal('pool-details-modal')">
                        Close
                    </button>
                </div>
            </div>
        `;
        
        openModal('pool-details-modal');
    } catch (error) {
        console.error('Error loading pool details:', error);
        showNotification('Error loading pool details', 'error');
    }
}

async function addAccountToPool() {
    const select = document.getElementById('add-account-select');
    const accountId = select.value;
    
    if (!accountId) {
        showNotification('Please select an account', 'warning');
        return;
    }
    
    try {
        await apiCall(`/api/pools/${currentPool.id}/accounts`, 'POST', { accountId });
        showNotification('Account added to pool', 'success');
        showPoolDetails(currentPool.id);
    } catch (error) {
        console.error('Error adding account to pool:', error);
        showNotification(error.message, 'error');
    }
}

async function removeAccountFromPool(poolId, accountId) {
    if (!confirm('Remove this account from the pool?')) return;
    
    try {
        await apiCall(`/api/pools/${poolId}/accounts/${accountId}`, 'DELETE');
        showNotification('Account removed from pool', 'success');
        showPoolDetails(poolId);
    } catch (error) {
        console.error('Error removing account from pool:', error);
        showNotification(error.message, 'error');
    }
}

// Accounts
async function loadAccounts() {
    try {
        const accounts = await apiCall('/api/accounts');
        const accountsList = document.getElementById('accounts-list');
        
        if (accounts.length === 0) {
            accountsList.innerHTML = '<p class="empty-state">No accounts added yet</p>';
            return;
        }
        
        accountsList.innerHTML = accounts.map(acc => `
            <div class="account-card">
                <div class="account-header">
                    <div class="account-title">
                        <i class="fas fa-${acc.type === 'google' ? 'google' : 'microsoft'}"></i>
                        <h4>${acc.name}</h4>
                    </div>
                    <span class="pool-badge badge-active">${acc.type}</span>
                </div>
                <div class="account-info">
                    <div class="info-row">
                        <label>Auth Method:</label>
                        <span>${acc.authMethod}</span>
                    </div>
                    <div class="info-row">
                        <label>Remote Name:</label>
                        <span>${acc.remoteName}</span>
                    </div>
                    ${acc.usage && acc.usage.used ? `
                    <div class="info-row">
                        <label>Used:</label>
                        <span>${acc.usage.used}</span>
                    </div>
                    <div class="info-row">
                        <label>Free:</label>
                        <span>${acc.usage.free || 'N/A'}</span>
                    </div>
                    ${acc.usage.total ? `
                    <div style="margin-top: 8px;">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${calculateUsagePercent(acc.usage)}%"></div>
                        </div>
                    </div>
                    ` : ''}
                    ` : ''}
                </div>
                <div class="account-actions">
                    <button class="btn btn-secondary btn-small" onclick="refreshAccount('${acc.id}')">
                        <i class="fas fa-sync"></i> Refresh
                    </button>
                    <button class="btn btn-danger btn-small" onclick="deleteAccount('${acc.id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading accounts:', error);
        showNotification('Error loading accounts', 'error');
    }
}

function calculateUsagePercent(usage) {
    if (!usage.used || !usage.total) return 0;
    
    const parseSize = (str) => {
        const match = str.match(/(\d+\.?\d*)\s*([KMGT]?B)/i);
        if (!match) return 0;
        let size = parseFloat(match[1]);
        const unit = match[2].toUpperCase();
        if (unit.includes('T')) size *= 1024 * 1024;
        else if (unit.includes('G')) size *= 1024;
        else if (unit.includes('K')) size /= 1024;
        return size;
    };
    
    const usedGB = parseSize(usage.used);
    const totalGB = parseSize(usage.total);
    
    return totalGB > 0 ? Math.min((usedGB / totalGB) * 100, 100) : 0;
}

async function refreshAccount(accountId) {
    try {
        showNotification('Refreshing account...', 'info');
        await apiCall(`/api/accounts/${accountId}/refresh`, 'POST');
        showNotification('Account refreshed', 'success');
        await loadAccounts();
    } catch (error) {
        console.error('Error refreshing account:', error);
        showNotification(error.message, 'error');
    }
}

async function deleteAccount(accountId) {
    if (!confirm('Are you sure you want to delete this account? It will be removed from all pools.')) return;
    
    try {
        await apiCall(`/api/accounts/${accountId}`, 'DELETE');
        showNotification('Account deleted', 'success');
        await loadAccounts();
        await loadPools();
        await loadDashboard();
    } catch (error) {
        console.error('Error deleting account:', error);
        showNotification(error.message, 'error');
    }
}

// System Status
async function loadSystemStatus() {
    try {
        const status = await apiCall('/api/status');
        document.getElementById('rclone-version').textContent = status.rcloneVersion || 'Unknown';
    } catch (error) {
        console.error('Error loading system status:', error);
    }
}

// Forms
function setupForms() {
    // Create Pool Form
    const createPoolForm = document.getElementById('create-pool-form');
    const chunkerCheckbox = createPoolForm.querySelector('input[name="enableChunker"]');
    const chunkSizeGroup = document.getElementById('chunk-size-group');
    
    chunkerCheckbox.addEventListener('change', (e) => {
        chunkSizeGroup.style.display = e.target.checked ? 'block' : 'none';
    });
    
    createPoolForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(createPoolForm);
        
        const data = {
            name: formData.get('name'),
            description: formData.get('description'),
            serveProtocol: formData.get('serveProtocol'),
            enableChunker: formData.get('enableChunker') === 'on',
            chunkSize: formData.get('chunkSize'),
            allowSplitFiles: formData.get('allowSplitFiles') === 'on'
        };
        
        try {
            await apiCall('/api/pools', 'POST', data);
            showNotification('Pool created successfully', 'success');
            closeModal('create-pool-modal');
            createPoolForm.reset();
            await loadPools();
            await loadDashboard();
        } catch (error) {
            console.error('Error creating pool:', error);
            showNotification(error.message, 'error');
        }
    });
}

// Modals
function showCreatePoolModal() {
    openModal('create-pool-modal');
}

function showAddAccountModal() {
    openModal('add-account-modal');
}

function selectAuthMethod(method) {
    const container = document.getElementById('auth-form-container');
    
    if (method === 'oauth') {
        container.innerHTML = `
            <form id="oauth-form" onsubmit="event.preventDefault(); submitOAuthForm();">
                <div class="form-group">
                    <label>Account Name *</label>
                    <input type="text" name="name" required placeholder="e.g., My Google Drive">
                </div>
                <div class="form-group">
                    <label>Provider *</label>
                    <select name="type" required>
                        <option value="google">Google Drive</option>
                        <option value="microsoft">Microsoft OneDrive</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>OAuth Token (JSON) *</label>
                    <textarea name="token" required placeholder='{"access_token": "...", "token_type": "Bearer", ...}' rows="6"></textarea>
                    <small style="color: var(--text-muted); display: block; margin-top: 8px;">
                        Get your token by running: <code>rclone authorize drive</code> or <code>rclone authorize onedrive</code>
                    </small>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" onclick="closeModal('add-account-modal')">Cancel</button>
                    <button type="submit" class="btn btn-primary">Add Account</button>
                </div>
            </form>
        `;
    } else if (method === 'service') {
        container.innerHTML = `
            <form id="service-form" onsubmit="event.preventDefault(); submitServiceForm();">
                <div class="form-group">
                    <label>Account Name *</label>
                    <input type="text" name="name" required placeholder="e.g., Service Account 1">
                </div>
                <div class="form-group">
                    <label>Provider</label>
                    <select name="type" required>
                        <option value="google">Google Drive (Service Account)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Service Account JSON *</label>
                    <textarea name="serviceAccountJson" required placeholder='{"type": "service_account", "project_id": "...", ...}' rows="8"></textarea>
                    <small style="color: var(--text-muted); display: block; margin-top: 8px;">
                        Paste the entire contents of your service account JSON file
                    </small>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" onclick="closeModal('add-account-modal')">Cancel</button>
                    <button type="submit" class="btn btn-primary">Add Account</button>
                </div>
            </form>
        `;
    } else if (method === 'remote') {
        container.innerHTML = `
            <div class="instructions">
                <h4>Remote Authentication via Rclone</h4>
                <ol>
                    <li>SSH into your Raspberry Pi</li>
                    <li>Run: <code>docker exec -it pooled-storage-manager rclone config</code></li>
                    <li>Follow the interactive setup for your cloud provider</li>
                    <li>After configuration, add the account using OAuth method above</li>
                </ol>
                <p style="margin-top: 16px; color: var(--text-muted);">
                    This method allows you to authenticate using rclone's built-in web interface and is recommended for first-time setup.
                </p>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn btn-secondary" onclick="closeModal('add-account-modal')">Close</button>
            </div>
        `;
    }
}

async function submitOAuthForm() {
    const form = document.getElementById('oauth-form');
    const formData = new FormData(form);
    
    try {
        const token = JSON.parse(formData.get('token'));
        
        const data = {
            name: formData.get('name'),
            type: formData.get('type'),
            token
        };
        
        await apiCall('/api/accounts/oauth', 'POST', data);
        showNotification('Account added successfully', 'success');
        closeModal('add-account-modal');
        await loadAccounts();
        await loadDashboard();
    } catch (error) {
        console.error('Error adding account:', error);
        showNotification(error.message, 'error');
    }
}

async function submitServiceForm() {
    const form = document.getElementById('service-form');
    const formData = new FormData(form);
    
    try {
        const serviceAccountJson = JSON.parse(formData.get('serviceAccountJson'));
        
        const data = {
            name: formData.get('name'),
            type: formData.get('type'),
            serviceAccountJson
        };
        
        await apiCall('/api/accounts/service', 'POST', data);
        showNotification('Service account added successfully', 'success');
        closeModal('add-account-modal');
        await loadAccounts();
        await loadDashboard();
    } catch (error) {
        console.error('Error adding service account:', error);
        showNotification(error.message, 'error');
    }
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Notifications
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        background: ${type === 'success' ? 'var(--success-color)' : type === 'error' ? 'var(--danger-color)' : 'var(--info-color)'};
        color: white;
        border-radius: 8px;
        box-shadow: var(--shadow-lg);
        z-index: 10000;
        animation: slideIn 0.3s;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Activity Log
function addActivity(message, type = 'info') {
    activityLog.unshift({
        message,
        type,
        time: new Date().toLocaleTimeString()
    });
    
    // Keep only last 20 activities
    if (activityLog.length > 20) {
        activityLog = activityLog.slice(0, 20);
    }
    
    updateActivityLog();
}

function updateActivityLog() {
    const container = document.getElementById('activity-log');
    
    if (activityLog.length === 0) {
        container.innerHTML = '<p class="empty-state">No recent activity</p>';
        return;
    }
    
    container.innerHTML = activityLog.map(activity => `
        <div class="activity-item">
            <div>${activity.message}</div>
            <div class="time">${activity.time}</div>
        </div>
    `).join('');
}

// Add animation keyframes
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);
