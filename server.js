const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { exec, spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cron = require('node-cron');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 20050;
const RCLONE_CONFIG_DIR = process.env.RCLONE_CONFIG_DIR || '/config';
const RCLONE_CONFIG_FILE = path.join(RCLONE_CONFIG_DIR, 'rclone.conf');
const DATA_FILE = path.join(RCLONE_CONFIG_DIR, 'pooled-storage-data.json');

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static('public'));

// WebSocket server for real-time updates
const wss = new WebSocket.Server({ noServer: true });

// In-memory storage for active mounts and pools
let poolsData = {
  pools: [],
  accounts: [],
  mounts: []
};

// Active process tracking
const activeProcesses = new Map();

// Load data on startup
async function loadData() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    poolsData = JSON.parse(data);
    console.log('Loaded existing data');
  } catch (error) {
    console.log('No existing data file, starting fresh');
    await saveData();
  }
}

async function saveData() {
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(poolsData, null, 2));
  } catch (error) {
    console.error('Error saving data:', error);
  }
}

// Broadcast to all WebSocket clients
function broadcast(data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// Execute rclone command
function execRclone(args, options = {}) {
  return new Promise((resolve, reject) => {
    const cmd = `rclone ${args}`;
    exec(cmd, { ...options, env: { ...process.env, RCLONE_CONFIG: RCLONE_CONFIG_FILE } }, (error, stdout, stderr) => {
      if (error) {
        reject({ error: error.message, stderr, stdout });
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

// Get account usage statistics
async function getAccountUsage(remoteName) {
  try {
    const result = await execRclone(`about ${remoteName}:`);
    const lines = result.stdout.split('\n');
    const usage = {};
    
    lines.forEach(line => {
      if (line.includes('Total:')) usage.total = line.split(':')[1].trim();
      if (line.includes('Used:')) usage.used = line.split(':')[1].trim();
      if (line.includes('Free:')) usage.free = line.split(':')[1].trim();
    });
    
    return usage;
  } catch (error) {
    return { error: error.message };
  }
}

// === API ENDPOINTS ===

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Get all pools
app.get('/api/pools', async (req, res) => {
  res.json(poolsData.pools);
});

// Create new pool
app.post('/api/pools', async (req, res) => {
  try {
    const { name, description, enableChunker, allowSplitFiles, chunkSize, serveProtocol } = req.body;
    
    const pool = {
      id: uuidv4(),
      name,
      description,
      enableChunker: enableChunker || false,
      allowSplitFiles: allowSplitFiles || false,
      chunkSize: chunkSize || '2G',
      serveProtocol: serveProtocol || 'webdav',
      accounts: [],
      status: 'inactive',
      createdAt: new Date().toISOString(),
      mountPort: null
    };
    
    poolsData.pools.push(pool);
    await saveData();
    broadcast({ type: 'pool_created', pool });
    
    res.json(pool);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get pool by ID
app.get('/api/pools/:id', async (req, res) => {
  const pool = poolsData.pools.find(p => p.id === req.params.id);
  if (!pool) {
    return res.status(404).json({ error: 'Pool not found' });
  }
  res.json(pool);
});

// Update pool
app.put('/api/pools/:id', async (req, res) => {
  try {
    const poolIndex = poolsData.pools.findIndex(p => p.id === req.params.id);
    if (poolIndex === -1) {
      return res.status(404).json({ error: 'Pool not found' });
    }
    
    const pool = poolsData.pools[poolIndex];
    Object.assign(pool, req.body);
    pool.updatedAt = new Date().toISOString();
    
    await saveData();
    broadcast({ type: 'pool_updated', pool });
    
    res.json(pool);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete pool
app.delete('/api/pools/:id', async (req, res) => {
  try {
    const poolIndex = poolsData.pools.findIndex(p => p.id === req.params.id);
    if (poolIndex === -1) {
      return res.status(404).json({ error: 'Pool not found' });
    }
    
    const pool = poolsData.pools[poolIndex];
    
    // Stop mount if active
    if (pool.status === 'active') {
      await stopPoolMount(pool.id);
    }
    
    poolsData.pools.splice(poolIndex, 1);
    await saveData();
    broadcast({ type: 'pool_deleted', poolId: req.params.id });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all accounts
app.get('/api/accounts', async (req, res) => {
  res.json(poolsData.accounts);
});

// Add account (OAuth flow)
app.post('/api/accounts/oauth', async (req, res) => {
  try {
    const { name, type, token } = req.body; // type: 'google' or 'microsoft'
    
    const accountId = uuidv4();
    const remoteName = `${type}_${accountId.substring(0, 8)}`;
    
    // Create rclone remote configuration
    let configContent = '';
    
    if (type === 'google') {
      configContent = `[${remoteName}]\ntype = drive\nscope = drive\ntoken = ${JSON.stringify(token)}\nteam_drive = \n`;
    } else if (type === 'microsoft') {
      configContent = `[${remoteName}]\ntype = onedrive\ntoken = ${JSON.stringify(token)}\ndrive_type = personal\n`;
    }
    
    // Append to rclone config
    await fs.appendFile(RCLONE_CONFIG_FILE, `\n${configContent}`);
    
    // Get usage stats
    const usage = await getAccountUsage(remoteName);
    
    const account = {
      id: accountId,
      name,
      type,
      remoteName,
      authMethod: 'oauth',
      status: 'active',
      usage,
      addedAt: new Date().toISOString()
    };
    
    poolsData.accounts.push(account);
    await saveData();
    broadcast({ type: 'account_added', account });
    
    res.json(account);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add account (Service Account)
app.post('/api/accounts/service', async (req, res) => {
  try {
    const { name, type, serviceAccountJson } = req.body;
    
    const accountId = uuidv4();
    const remoteName = `${type}_sa_${accountId.substring(0, 8)}`;
    const saFilePath = path.join(RCLONE_CONFIG_DIR, `${remoteName}.json`);
    
    // Save service account JSON
    await fs.writeFile(saFilePath, JSON.stringify(serviceAccountJson, null, 2));
    
    // Create rclone remote configuration
    const configContent = `[${remoteName}]\ntype = drive\nscope = drive\nservice_account_file = ${saFilePath}\nteam_drive = \n`;
    
    await fs.appendFile(RCLONE_CONFIG_FILE, `\n${configContent}`);
    
    const usage = await getAccountUsage(remoteName);
    
    const account = {
      id: accountId,
      name,
      type: 'google',
      remoteName,
      authMethod: 'service_account',
      status: 'active',
      usage,
      addedAt: new Date().toISOString()
    };
    
    poolsData.accounts.push(account);
    await saveData();
    broadcast({ type: 'account_added', account });
    
    res.json(account);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start OAuth authorization - Generate auth URL
app.post('/api/accounts/oauth/start', async (req, res) => {
  try {
    const { type } = req.body;
    const stateId = uuidv4();
    
    // Store state for later verification
    const authState = {
      type,
      timestamp: Date.now(),
      completed: false
    };
    
    // Save state (in production, use Redis or similar)
    global.authStates = global.authStates || {};
    global.authStates[stateId] = authState;
    
    // Get authorization URL from rclone
    const driveType = type === 'google' ? 'drive' : 'onedrive';
    
    // Create a temp rclone config to get auth URL
    const tempRemote = `temp_${Date.now()}`;
    const scope = type === 'google' ? '{"scope":"drive"}' : '';
    
    // Get the auth URL
    const cmd = `rclone authorize ${driveType} ${scope} --auth-no-open-browser`;
    
    exec(cmd, { env: { ...process.env, RCLONE_CONFIG: RCLONE_CONFIG_FILE } }, (error, stdout, stderr) => {
      if (error) {
        return res.status(500).json({ error: 'Failed to generate auth URL', details: stderr });
      }
      
      // Extract the auth URL from stdout
      const urlMatch = stdout.match(/https:\/\/[^\s]+/);
      if (urlMatch) {
        res.json({
          authUrl: urlMatch[0],
          stateId,
          instructions: 'Click the URL to authorize, then you will be redirected back'
        });
      } else {
        res.status(500).json({ error: 'Could not generate auth URL', output: stdout });
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// OAuth callback handler
app.get('/api/accounts/oauth/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code || !state) {
      return res.status(400).send('Missing code or state');
    }
    
    // Verify state
    global.authStates = global.authStates || {};
    const authState = global.authStates[state];
    
    if (!authState) {
      return res.status(400).send('Invalid state');
    }
    
    // Store the code for the frontend to retrieve
    authState.code = code;
    authState.completed = true;
    
    // Redirect back to dashboard with success
    res.send(`
      <html>
        <head><title>Authorization Successful</title></head>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1>✅ Authorization Successful!</h1>
          <p>You can close this window and return to the dashboard.</p>
          <p>Your code: <code>${code}</code></p>
          <script>
            window.opener?.postMessage({ type: 'oauth_success', code: '${code}', state: '${state}' }, '*');
            setTimeout(() => window.close(), 3000);
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send('Authorization failed: ' + error.message);
  }
});

// Complete OAuth with code
app.post('/api/accounts/oauth/complete', async (req, res) => {
  try {
    const { name, type, code, stateId } = req.body;
    
    // Verify state
    global.authStates = global.authStates || {};
    const authState = global.authStates[stateId];
    
    if (!authState || !authState.completed) {
      return res.status(400).json({ error: 'Invalid or incomplete authorization' });
    }
    
    // Exchange code for token using rclone
    const driveType = type === 'google' ? 'drive' : 'onedrive';
    const accountId = uuidv4();
    const remoteName = `${type}_${accountId.substring(0, 8)}`;
    
    // Create the remote with the code
    // This requires running rclone config programmatically
    // For now, we'll need the full token JSON
    
    res.status(501).json({ 
      error: 'Token exchange not yet implemented',
      message: 'Please use the OAuth Token method and paste the full JSON token'
    });
    
    // Clean up state
    delete global.authStates[stateId];
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add account to pool
app.post('/api/pools/:poolId/accounts', async (req, res) => {
  try {
    const { accountId } = req.body;
    const pool = poolsData.pools.find(p => p.id === req.params.poolId);
    const account = poolsData.accounts.find(a => a.id === accountId);
    
    if (!pool || !account) {
      return res.status(404).json({ error: 'Pool or account not found' });
    }
    
    if (pool.accounts.includes(accountId)) {
      return res.status(400).json({ error: 'Account already in pool' });
    }
    
    pool.accounts.push(accountId);
    pool.updatedAt = new Date().toISOString();
    
    await saveData();
    broadcast({ type: 'pool_account_added', poolId: pool.id, accountId });
    
    res.json(pool);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove account from pool
app.delete('/api/pools/:poolId/accounts/:accountId', async (req, res) => {
  try {
    const pool = poolsData.pools.find(p => p.id === req.params.poolId);
    
    if (!pool) {
      return res.status(404).json({ error: 'Pool not found' });
    }
    
    pool.accounts = pool.accounts.filter(a => a !== req.params.accountId);
    pool.updatedAt = new Date().toISOString();
    
    await saveData();
    broadcast({ type: 'pool_account_removed', poolId: pool.id, accountId: req.params.accountId });
    
    res.json(pool);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete account
app.delete('/api/accounts/:id', async (req, res) => {
  try {
    const accountIndex = poolsData.accounts.findIndex(a => a.id === req.params.id);
    if (accountIndex === -1) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    const account = poolsData.accounts[accountIndex];
    
    // Remove from all pools
    poolsData.pools.forEach(pool => {
      pool.accounts = pool.accounts.filter(a => a !== req.params.id);
    });
    
    poolsData.accounts.splice(accountIndex, 1);
    await saveData();
    broadcast({ type: 'account_deleted', accountId: req.params.id });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start pool mount
app.post('/api/pools/:id/start', async (req, res) => {
  try {
    const pool = poolsData.pools.find(p => p.id === req.params.id);
    if (!pool) {
      return res.status(404).json({ error: 'Pool not found' });
    }
    
    if (pool.accounts.length === 0) {
      return res.status(400).json({ error: 'No accounts in pool' });
    }
    
    // Create union remote config
    const poolRemoteName = `pool_${pool.id.substring(0, 8)}`;
    const accounts = poolsData.accounts.filter(a => pool.accounts.includes(a.id));
    const remotes = accounts.map(a => `${a.remoteName}:`).join(' ');
    
    // Create union config
    let unionConfig = `[${poolRemoteName}]\ntype = union\nupstreams = ${remotes}\naction_policy = epall\ncreate_policy = epmfs\nsearch_policy = ff\n`;
    
    // Add chunker if enabled
    let finalRemoteName = poolRemoteName;
    if (pool.enableChunker) {
      const chunkerName = `${poolRemoteName}_chunker`;
      const chunkerConfig = `\n[${chunkerName}]\ntype = chunker\nremote = ${poolRemoteName}:\nchunk_size = ${pool.chunkSize}\nhash_type = md5\n`;
      unionConfig += chunkerConfig;
      finalRemoteName = chunkerName;
    }
    
    // Update rclone config
    const existingConfig = await fs.readFile(RCLONE_CONFIG_FILE, 'utf8');
    const updatedConfig = existingConfig.replace(new RegExp(`\\[${poolRemoteName}\\][\\s\\S]*?(?=\\n\\[|$)`, 'g'), '') + '\n' + unionConfig;
    await fs.writeFile(RCLONE_CONFIG_FILE, updatedConfig);
    
    // Find available port
    const basePort = 20060;
    let port = basePort;
    while (activeProcesses.has(port) && port < 20100) {
      port++;
    }
    
    // Start rclone serve
    const serveType = pool.serveProtocol || 'webdav';
    const args = [
      'serve', serveType,
      `${finalRemoteName}:`,
      '--addr', `:${port}`,
      '--config', RCLONE_CONFIG_FILE,
      '--vfs-cache-mode', 'full',
      '--vfs-cache-max-age', '1h',
      '--buffer-size', '64M',
      '--log-level', 'INFO'
    ];
    
    const process = spawn('rclone', args);
    
    process.stdout.on('data', (data) => {
      console.log(`Pool ${pool.id}: ${data}`);
      broadcast({ type: 'pool_log', poolId: pool.id, message: data.toString() });
    });
    
    process.stderr.on('data', (data) => {
      console.error(`Pool ${pool.id} error: ${data}`);
      broadcast({ type: 'pool_error', poolId: pool.id, message: data.toString() });
    });
    
    process.on('close', (code) => {
      console.log(`Pool ${pool.id} process exited with code ${code}`);
      activeProcesses.delete(port);
      pool.status = 'inactive';
      pool.mountPort = null;
      saveData();
      broadcast({ type: 'pool_stopped', poolId: pool.id });
    });
    
    activeProcesses.set(port, { process, poolId: pool.id });
    
    pool.status = 'active';
    pool.mountPort = port;
    pool.remoteName = finalRemoteName;
    pool.startedAt = new Date().toISOString();
    
    await saveData();
    broadcast({ type: 'pool_started', pool });
    
    res.json({ 
      success: true, 
      pool,
      mountInfo: {
        protocol: serveType,
        port,
        url: `${serveType}://192.168.100.14:${port}`
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stop pool mount
async function stopPoolMount(poolId) {
  const pool = poolsData.pools.find(p => p.id === poolId);
  if (!pool || !pool.mountPort) {
    throw new Error('Pool not active');
  }
  
  const processInfo = activeProcesses.get(pool.mountPort);
  if (processInfo) {
    processInfo.process.kill();
    activeProcesses.delete(pool.mountPort);
  }
  
  pool.status = 'inactive';
  pool.mountPort = null;
  await saveData();
  broadcast({ type: 'pool_stopped', poolId });
}

app.post('/api/pools/:id/stop', async (req, res) => {
  try {
    await stopPoolMount(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get pool statistics
app.get('/api/pools/:id/stats', async (req, res) => {
  try {
    const pool = poolsData.pools.find(p => p.id === req.params.id);
    if (!pool) {
      return res.status(404).json({ error: 'Pool not found' });
    }
    
    const accounts = poolsData.accounts.filter(a => pool.accounts.includes(a.id));
    const usagePromises = accounts.map(a => getAccountUsage(a.remoteName));
    const usages = await Promise.all(usagePromises);
    
    const stats = {
      poolId: pool.id,
      accountCount: accounts.length,
      accounts: accounts.map((acc, idx) => ({
        ...acc,
        usage: usages[idx]
      })),
      totalSpace: 0,
      usedSpace: 0,
      freeSpace: 0
    };
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Refresh account usage
app.post('/api/accounts/:id/refresh', async (req, res) => {
  try {
    const account = poolsData.accounts.find(a => a.id === req.params.id);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    const usage = await getAccountUsage(account.remoteName);
    account.usage = usage;
    account.lastRefreshed = new Date().toISOString();
    
    await saveData();
    broadcast({ type: 'account_refreshed', account });
    
    res.json(account);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get system status
app.get('/api/status', async (req, res) => {
  try {
    const result = await execRclone('version');
    
    res.json({
      rcloneVersion: result.stdout.split('\n')[0],
      activePools: poolsData.pools.filter(p => p.status === 'active').length,
      totalPools: poolsData.pools.length,
      totalAccounts: poolsData.accounts.length,
      activeMounts: activeProcesses.size
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Periodic stats update (every 5 minutes)
cron.schedule('*/5 * * * *', async () => {
  console.log('Updating account statistics...');
  
  for (const account of poolsData.accounts) {
    try {
      const usage = await getAccountUsage(account.remoteName);
      account.usage = usage;
      account.lastRefreshed = new Date().toISOString();
    } catch (error) {
      console.error(`Error updating stats for ${account.remoteName}:`, error);
    }
  }
  
  await saveData();
  broadcast({ type: 'stats_updated', accounts: poolsData.accounts });
});

// HTTP server upgrade for WebSocket
const server = app.listen(PORT, () => {
  console.log(`Pooled Storage Manager running on port ${PORT}`);
  loadData();
});

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  
  // Send initial data
  ws.send(JSON.stringify({ 
    type: 'initial_data', 
    data: poolsData 
  }));
  
  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  
  // Stop all active mounts
  for (const [port, info] of activeProcesses) {
    info.process.kill();
  }
  
  await saveData();
  server.close(() => {
    process.exit(0);
  });
});
