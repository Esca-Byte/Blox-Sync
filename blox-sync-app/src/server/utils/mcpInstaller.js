'use strict';

const path = require('path');
const fs = require('fs-extra');
const os = require('os');

// ── Version stamp — bump this when the bundled MCP changes ───────────────────
const MCP_VERSION = '1.0.0';

// ── Stable install target on the user's machine ───────────────────────────────
function getMcpInstallDir() {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(appData, 'BloxSync', 'mcp');
}

// ── Where electron-builder places extraResources ─────────────────────────────
function getMcpResourcesPath() {
  if (process.resourcesPath) {
    return path.join(process.resourcesPath, 'mcp');
  }
  // Dev mode fallback
  return path.join(__dirname, '..', '..', '..', '..', 'blox-sync-mcp');
}

/**
 * Check if MCP is already installed at the current version (synchronous, fast).
 * @returns {{ installed: boolean, version: string|null, indexPath: string }}
 */
function getMcpStatus() {
  const destDir = getMcpInstallDir();
  const stampFile = path.join(destDir, '.mcp_version');
  const indexFile = path.join(destDir, 'src', 'index.js');

  try {
    const stamp = fs.readFileSync(stampFile, 'utf8').trim();
    if (stamp === MCP_VERSION && fs.existsSync(indexFile)) {
      return { installed: true, version: stamp, indexPath: indexFile };
    }
  } catch (_) { /* not installed */ }

  return { installed: false, version: null, indexPath: indexFile };
}

/**
 * Recursively collect all files in a directory.
 */
async function collectFiles(dir) {
  const results = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = await collectFiles(full);
      results.push(...sub);
    } else {
      results.push(full);
    }
  }
  return results;
}

/**
 * Extracts the bundled MCP source to %APPDATA%\BloxSync\mcp\ with progress reporting.
 *
 * @param {Function} onProgress  - ({ percent: number, copied: number, total: number, file: string }) => void
 * @param {Function} log         - (message, level) => void
 * @returns {Promise<string|null>} absolute path to mcp/src/index.js, or null on failure
 */
async function extractAndInstallMcp(onProgress, log) {
  try {
    const srcDir = getMcpResourcesPath();
    const destDir = getMcpInstallDir();
    const stampFile = path.join(destDir, '.mcp_version');
    const indexFile = path.join(destDir, 'src', 'index.js');

    // Fast path: synchronous stamp check
    try {
      const stamp = fs.readFileSync(stampFile, 'utf8').trim();
      if (stamp === MCP_VERSION && fs.existsSync(indexFile)) {
        log(`MCP already up to date (v${MCP_VERSION}) — skipping extract.`, 'info');
        onProgress({ percent: 100, copied: 1, total: 1, file: 'Already installed' });
        return indexFile;
      }
    } catch (_) { /* fall through */ }

    // Check if bundled source exists
    if (!(await fs.pathExists(srcDir))) {
      log(`MCP source not found at ${srcDir} — skipping.`, 'info');
      return null;
    }

    log(`Installing MCP server (v${MCP_VERSION}) to ${destDir} ...`, 'info');
    await fs.ensureDir(destDir);

    // Collect all files for accurate progress
    onProgress({ percent: 0, copied: 0, total: 0, file: 'Scanning files...' });
    const allFiles = await collectFiles(srcDir);
    const total = allFiles.length;
    let copied = 0;

    for (const srcFile of allFiles) {
      const rel = path.relative(srcDir, srcFile);
      const destFile = path.join(destDir, rel);
      await fs.ensureDir(path.dirname(destFile));
      await fs.copyFile(srcFile, destFile);
      copied++;
      const percent = Math.round((copied / total) * 100);
      onProgress({ percent, copied, total, file: rel });
    }

    await fs.writeFile(stampFile, MCP_VERSION, 'utf8');
    log(`MCP server installed at ${destDir}`, 'info');
    return indexFile;
  } catch (err) {
    log(`MCP install error: ${err.message}`, 'warn');
    return null;
  }
}

// ── IDE config descriptors ────────────────────────────────────────────────────

function getIdeConfigs() {
  const home = os.homedir();
  const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');

  return [
    {
      name: 'Antigravity',
      configPath: path.join(home, '.gemini', 'config', 'mcp_config.json'),
      read: (raw) => JSON.parse(raw),
      write: (obj) => JSON.stringify(obj, null, 2),
      getServers: (obj) => { obj.mcpServers = obj.mcpServers || {}; return obj.mcpServers; },
    },
    {
      name: 'Cursor',
      configPath: path.join(appData, 'Cursor', 'User', 'globalStorage', 'cursor.mcp', 'mcp.json'),
      read: (raw) => JSON.parse(raw),
      write: (obj) => JSON.stringify(obj, null, 2),
      getServers: (obj) => { obj.mcpServers = obj.mcpServers || {}; return obj.mcpServers; },
    },
    {
      name: 'Claude Desktop',
      configPath: path.join(appData, 'Claude', 'claude_desktop_config.json'),
      read: (raw) => JSON.parse(raw),
      write: (obj) => JSON.stringify(obj, null, 2),
      getServers: (obj) => { obj.mcpServers = obj.mcpServers || {}; return obj.mcpServers; },
    },
  ];
}

/**
 * Writes the roblox-bridge MCP entry into every IDE config that already exists.
 * Never clobbers other MCP servers the user has.
 *
 * @param {string}   mcpIndexPath
 * @param {Function} log
 * @returns {Promise<string[]>} list of IDE names configured
 */
async function configureIDEs(mcpIndexPath, log) {
  const configured = [];
  const normalizedPath = mcpIndexPath.replace(/\\/g, '/');

  const mcpEntry = {
    command: 'node',
    args: [normalizedPath],
    env: { BLOX_SYNC_URL: 'http://localhost:7777' },
  };

  for (const ide of getIdeConfigs()) {
    try {
      const configDir = path.dirname(ide.configPath);
      const configExists = await fs.pathExists(ide.configPath);

      if (!configExists) {
        if (ide.name === 'Antigravity') {
          await fs.ensureDir(configDir);
          const newConfig = { mcpServers: { 'roblox-bridge': mcpEntry } };
          await fs.writeFile(ide.configPath, ide.write(newConfig), 'utf8');
          log(`MCP auto-configured for ${ide.name} (new config created)`, 'info');
          configured.push(ide.name);
        } else if (await fs.pathExists(configDir)) {
          const newConfig = { mcpServers: { 'roblox-bridge': mcpEntry } };
          await fs.writeFile(ide.configPath, ide.write(newConfig), 'utf8');
          log(`MCP auto-configured for ${ide.name}`, 'info');
          configured.push(ide.name);
        }
        continue;
      }

      const raw = await fs.readFile(ide.configPath, 'utf8');
      let obj;
      try { obj = ide.read(raw); } catch {
        log(`MCP config for ${ide.name} is invalid JSON — skipping`, 'warn');
        continue;
      }

      const servers = ide.getServers(obj);
      servers['roblox-bridge'] = mcpEntry;
      await fs.writeFile(ide.configPath, ide.write(obj), 'utf8');
      log(`MCP configured for ${ide.name} at ${ide.configPath}`, 'info');
      configured.push(ide.name);
    } catch (err) {
      log(`MCP config failed for ${ide.name}: ${err.message}`, 'warn');
    }
  }

  return configured;
}

module.exports = { extractAndInstallMcp, configureIDEs, getMcpStatus };
