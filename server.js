const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');
const decompress = require('decompress');

// Configurable PocketBase Version
const PB_VERSION = process.env.PB_VERSION || '0.22.21';
const PORT = process.env.PORT || '8080';
const DATA_DIR = process.env.PB_DATA_DIR || path.join(__dirname, 'pb_data');

// Detect OS Architecture (Render uses linux-amd64 or linux-arm64)
function getDownloadUrl() {
  const platform = process.platform === 'win32' ? 'windows' : (process.platform === 'darwin' ? 'darwin' : 'linux');
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
  const ext = 'zip';
  return `https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_${platform}_${arch}.${ext}`;
}

const pbBinaryName = process.platform === 'win32' ? 'pocketbase.exe' : 'pocketbase';
const pbBinaryPath = path.join(__dirname, pbBinaryName);

// Helper function to download file with redirect support
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    
    function makeRequest(currentUrl) {
      https.get(currentUrl, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          // Handle GitHub asset redirect
          return makeRequest(response.headers.location);
        }
        
        if (response.statusCode !== 200) {
          return reject(new Error(`Failed to download PocketBase: HTTP ${response.statusCode}`));
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close(() => resolve(dest));
        });
      }).on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    }

    makeRequest(url);
  });
}

async function preparePocketBase() {
  if (fs.existsSync(pbBinaryPath)) {
    console.log(`[PocketBase] Binary already exists at ${pbBinaryPath}`);
    return;
  }

  const downloadUrl = getDownloadUrl();
  const zipPath = path.join(__dirname, 'pocketbase.zip');

  console.log(`[PocketBase] Downloading version v${PB_VERSION}...`);
  console.log(`[PocketBase] URL: ${downloadUrl}`);
  
  await downloadFile(downloadUrl, zipPath);
  console.log('[PocketBase] Download complete. Extracting binary...');

  await decompress(zipPath, __dirname);
  console.log('[PocketBase] Extraction complete.');

  // Clean up zip archive
  try {
    fs.unlinkSync(zipPath);
  } catch (err) {}

  // Give executable permission on Linux/Unix
  if (process.platform !== 'win32') {
    fs.chmodSync(pbBinaryPath, 0o755);
  }
}

async function startPocketBase() {
  try {
    // Ensure pb_data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    await preparePocketBase();

    console.log(`[PocketBase] Launching on 0.0.0.0:${PORT}...`);
    console.log(`[PocketBase] Data directory: ${DATA_DIR}`);

    const pbArgs = [
      'serve',
      `--http=0.0.0.0:${PORT}`,
      `--dir=${DATA_DIR}`
    ];

    const pbProcess = spawn(pbBinaryPath, pbArgs, {
      stdio: 'inherit',
      env: process.env
    });

    pbProcess.on('error', (err) => {
      console.error('[PocketBase] Process error:', err);
      process.exit(1);
    });

    pbProcess.on('exit', (code, signal) => {
      console.log(`[PocketBase] Process exited with code ${code} (signal: ${signal})`);
      process.exit(code || 0);
    });

    // Graceful Shutdown handling
    const shutdown = () => {
      console.log('[PocketBase] Shutting down...');
      pbProcess.kill('SIGTERM');
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (error) {
    console.error('[PocketBase] Startup failed:', error);
    process.exit(1);
  }
}

startPocketBase();
