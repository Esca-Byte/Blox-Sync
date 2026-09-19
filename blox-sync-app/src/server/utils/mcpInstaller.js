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
    // Running as packaged EXE
    return path.join(process.resourcesPath, 'mcp');
  }
  // Dev mode fallback: go up from blox-sync-app/src/server/utils/ to repo root
  return path.join(__dirname, '..', '..', '..', '..', 'blox-sync-mcp');
}

/**
 * Extracts the bundled MCP source to %APPDATA%\BloxSync\mcp\ (if version changed)
 * and returns the absolute path to index.js.
 * @param {Function} log  - logger(message, level)
 * @returns {Promise<string|null>} absolute path to mcp/src/index.js, or null on failure
 */
async function extractAndInstallMcp(log) {
  try {
    const srcDir = getMcpResourcesPath();
    const destDir = getMcpInstallDir();
    const stampFile = path.join(destDir, '.mcp_version');
    const indexFile = path.join(destDir, 'src', 'index.js');

    // Check if bundled MCP source exists
    if (!(await fs.pathExists(srcDir))) {
      log(`MCP source not found at ${srcDir} — skipping MCP setup.`, 'info');
      return null;
    }

    // Check version stamp to avoid redundant re-extracts
    let installedVersion = null;
    if (await fs.pathExists(stampFile)) {
      installedVersion = (await fs.readFile(stampFile, 'utf8')).trim();
    }

    if (installedVersion === MCP_VERSION && (await fs.pathExists(indexFile))) {
      log(`MCP already up to date (v${MCP_VERSION}) at ${destDir}`, 'info');
      return indexFile;
    }

    // Copy bundled MCP → install dir
    log(`Installing MCP server (v${MCP_VERSION}) to ${destDir} ...`, 'info');
    await fs.ensureDir(destDir);
    await fs.copy(srcDir, destDir, { overwrite: true });
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
 * Never touches IDE configs that don't exist (avoids creating unwanted files).
 * Never clobbers other MCP servers the user has configured.
 *
 * @param {string}   mcpIndexPath  - absolute path to installed mcp/src/index.js
 * @param {Function} log           - logger(message, level)
 * @returns {Promise<string[]>}    - list of IDE names that were configured
 */
async function configureIDEs(mcpIndexPath, log) {
  const configured = [];

  // Normalise to forward slashes (works in all MCP clients on Windows)
  const normalizedPath = mcpIndexPath.replace(/\\/g, '/');

  const mcpEntry = {
    command: 'node',
    args: [normalizedPath],
    env: {
      BLOX_SYNC_URL: 'http://localhost:7777',
    },
  };

  for (const ide of getIdeConfigs()) {
    try {
      const configDir = path.dirname(ide.configPath);
      const configExists = await fs.pathExists(ide.configPath);

      if (!configExists) {
        // Create the config directory + file for Antigravity since it's the primary IDE
        if (ide.name === 'Antigravity') {
          await fs.ensureDir(configDir);
          const newConfig = { mcpServers: { 'roblox-bridge': mcpEntry } };
          await fs.writeFile(ide.configPath, ide.write(newConfig), 'utf8');
          log(`MCP auto-configured for ${ide.name} (new config created)`, 'info');
          configured.push(ide.name);
        }
        // For other IDEs, only configure if they're already installed (config dir exists)
        else if (await fs.pathExists(configDir)) {
          const newConfig = { mcpServers: { 'roblox-bridge': mcpEntry } };
          await fs.writeFile(ide.configPath, ide.write(newConfig), 'utf8');
          log(`MCP auto-configured for ${ide.name}`, 'info');
          configured.push(ide.name);
        }
        continue;
      }

      // Config exists — read, merge, write
      const raw = await fs.readFile(ide.configPath, 'utf8');
      let obj;
      try {
        obj = ide.read(raw);
      } catch {
        log(`MCP config for ${ide.name} is invalid JSON — skipping`, 'warn');
        continue;
      }

      const servers = ide.getServers(obj);
      servers['roblox-bridge'] = mcpEntry;
      await fs.writeFile(ide.configPath, ide.write(obj), 'utf8');
      log(`MCP auto-configured for ${ide.name} at ${ide.configPath}`, 'info');
      configured.push(ide.name);
    } catch (err) {
      log(`MCP config failed for ${ide.name}: ${err.message}`, 'warn');
    }
  }

  return configured;
}

module.exports = { extractAndInstallMcp, configureIDEs };
