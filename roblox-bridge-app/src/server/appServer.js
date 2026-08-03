const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
const os = require('os');
const fs = require('fs-extra');
const chokidar = require('chokidar');
const { exec } = require('child_process');

function getDefaultDocumentsDir() {
  const home = process.env.USERPROFILE || os.homedir();
  if (process.platform === 'win32') {
    if (process.env.ONEDRIVE && fs.existsSync(path.join(process.env.ONEDRIVE, 'Documents'))) {
      return path.join(process.env.ONEDRIVE, 'Documents');
    }
    const oneDriveDocs = path.join(home, 'OneDrive', 'Documents');
    if (fs.existsSync(oneDriveDocs)) {
      return oneDriveDocs;
    }
  }
  return path.join(home, 'Documents');
}

function getDefaultProjectsDir() {
  return path.join(getDefaultDocumentsDir(), 'RobloxProjects');
}

class RojoParser {
  constructor(projectDir) {
    this.projectDir = projectDir;
  }

  async parseProjectConfig() {
    const configPath = path.join(this.projectDir, 'default.project.json');
    if (await fs.pathExists(configPath)) {
      try {
        const json = await fs.readJson(configPath);
        return { raw: json, mappings: this.extractMappings(json) };
      } catch (err) {
        console.error('[RojoParser] Error reading default.project.json:', err.message);
      }
    }

    return {
      raw: {},
      mappings: [
        { pathPrefix: 'src/ReplicatedStorage', robloxService: 'ReplicatedStorage' },
        { pathPrefix: 'src/ServerScriptService', robloxService: 'ServerScriptService' },
        { pathPrefix: 'src/ServerStorage', robloxService: 'ServerStorage' },
        { pathPrefix: 'src/StarterGui', robloxService: 'StarterGui' },
        { pathPrefix: 'src/StarterPack', robloxService: 'StarterPack' },
        { pathPrefix: 'src/Workspace', robloxService: 'Workspace' },
        { pathPrefix: 'src/StarterPlayer/StarterPlayerScripts', robloxService: 'StarterPlayer.StarterPlayerScripts' },
        { pathPrefix: 'src/StarterPlayer/StarterCharacterScripts', robloxService: 'StarterPlayer.StarterCharacterScripts' }
      ]
    };
  }

  extractMappings(json) {
    const mappings = [];
    if (!json || !json.tree) return mappings;

    const traverse = (node, currentRobloxPath) => {
      if (typeof node !== 'object' || node === null) return;
      if (node['$path']) {
        mappings.push({ pathPrefix: node['$path'].replace(/\\/g, '/'), robloxService: currentRobloxPath });
      }
      for (const [key, val] of Object.entries(node)) {
        if (key.startsWith('$')) continue;
        const nextPath = currentRobloxPath ? `${currentRobloxPath}.${key}` : key;
        traverse(val, nextPath);
      }
    };

    traverse(json.tree, '');
    return mappings;
  }

  getScriptInfo(relPath, mappings) {
    const normalizedRel = relPath.replace(/\\/g, '/');
    let scriptType = 'ModuleScript';
    let cleanRelPath = normalizedRel;

    const filename = path.basename(normalizedRel);
    if (/^init\.server\.lua[u]?$/.test(filename)) {
      scriptType = 'Script';
      cleanRelPath = path.dirname(normalizedRel);
    } else if (/^init\.client\.lua[u]?$/.test(filename)) {
      scriptType = 'LocalScript';
      cleanRelPath = path.dirname(normalizedRel);
    } else if (/^init\.lua[u]?$/.test(filename)) {
      scriptType = 'ModuleScript';
      cleanRelPath = path.dirname(normalizedRel);
    } else if (/\.server\.lua[u]?$/.test(normalizedRel)) {
      scriptType = 'Script';
      cleanRelPath = normalizedRel.replace(/\.server\.lua[u]?$/, '');
    } else if (/\.client\.lua[u]?$/.test(normalizedRel)) {
      scriptType = 'LocalScript';
      cleanRelPath = normalizedRel.replace(/\.client\.lua[u]?$/, '');
    } else if (/\.lua[u]?$/.test(normalizedRel)) {
      scriptType = 'ModuleScript';
      cleanRelPath = normalizedRel.replace(/\.lua[u]?$/, '');
    } else {
      return null; // Not a script
    }

    let robloxHierarchy = 'ReplicatedStorage';
    let matchedPrefixLength = 0;

    for (const map of mappings) {
      if (cleanRelPath.startsWith(map.pathPrefix)) {
        if (map.pathPrefix.length > matchedPrefixLength) {
          matchedPrefixLength = map.pathPrefix.length;
          const subPath = cleanRelPath.slice(map.pathPrefix.length).replace(/^\//, '');
          robloxHierarchy = subPath ? `${map.robloxService}.${subPath.replace(/\//g, '.')}` : map.robloxService;
        }
      }
    }

    const pathParts = robloxHierarchy.split('.');
    const scriptName = pathParts[pathParts.length - 1];

    return {
      scriptName,
      scriptType,
      fullRobloxPath: robloxHierarchy,
      robloxHierarchy,
      relPath: normalizedRel
    };
  }
}

class RobloxBridgeAppServer {
  constructor(options = {}) {
    this.port = options.port || 7777;
    this.baseProjectsDir = options.baseProjectsDir || getDefaultProjectsDir();
    this.activeProjectName = options.activeProjectName || 'DefaultProject';
    this.activeProjectPath = path.join(this.baseProjectsDir, this.activeProjectName);

    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });

    this.rojoParser = new RojoParser(this.activeProjectPath);
    this.projectConfig = null;
    this.watcher = null;

    this.trackedFiles = new Map(); // relPath -> data
    this.changeHistory = [];
    this.writeGuard = new Map();
    this.logs = [];
    this.lastStudioHeartbeat = 0;
    this.studioConnected = false;

    this.initExpress();
    this.initWebSocket();
  }

  log(message, type = 'info') {
    const entry = {
      timestamp: Date.now(),
      message,
      type
    };
    this.logs.push(entry);
    if (this.logs.length > 300) this.logs.shift();

    console.log(`[${type.toUpperCase()}] ${message}`);
    this.broadcast({ event: 'log_entry', entry });
  }

  async ensurePluginInstalled() {
    try {
      const localAppData = process.env.LOCALAPPDATA || path.join(require('os').homedir(), 'AppData', 'Local');
      const pluginsDir = path.join(localAppData, 'Roblox', 'Plugins');
      const pluginTargetPath = path.join(pluginsDir, 'RobloxBridge.lua');
      const pluginSourcePath = path.join(__dirname, 'RobloxBridge.lua');

      if (await fs.pathExists(pluginSourcePath)) {
        await fs.ensureDir(pluginsDir);
        await fs.copy(pluginSourcePath, pluginTargetPath, { overwrite: true });
        this.log(`Roblox Studio Plugin auto-installed/updated at: ${pluginTargetPath}`, 'info');
        return { success: true, path: pluginTargetPath };
      }
    } catch (err) {
      this.log(`Plugin auto-install skipped: ${err.message}`, 'info');
      return { success: false, error: err.message };
    }
  }

  async start() {
    await fs.ensureDir(this.baseProjectsDir);
    await this.ensurePluginInstalled();

    // Check existing projects
    const entries = await fs.readdir(this.baseProjectsDir, { withFileTypes: true });
    const existing = entries.filter(e => e.isDirectory()).map(e => e.name);
    if (existing.length > 0 && !existing.includes(this.activeProjectName)) {
      this.activeProjectName = existing[0];
      this.activeProjectPath = path.join(this.baseProjectsDir, this.activeProjectName);
    }

    await this.ensureActiveProjectExists();
    await this.loadProject();

    return new Promise((resolve) => {
      this.server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.log(`[INFO] Port ${this.port} is already in use. Connecting to active server instance.`);
          resolve();
        } else {
          console.error('[ERROR] Server error:', err);
          resolve();
        }
      });

      this.server.listen(this.port, () => {
        this.log(`Roblox Bridge Server running on http://localhost:${this.port}`, 'info');
        this.log(`Projects Directory: ${this.baseProjectsDir}`, 'info');
        this.log(`Active Project: ${this.activeProjectName}`, 'info');
        resolve();
      });
    });
  }

  async ensureActiveProjectExists() {
    if (!await fs.pathExists(this.activeProjectPath)) {
      await this.createProjectTemplate(this.activeProjectName);
    }
  }

  async createProjectTemplate(projectName) {
    const projDir = path.join(this.baseProjectsDir, projectName);
    await fs.ensureDir(projDir);

    const defaultProjectJson = {
      name: projectName,
      tree: {
        "$className": "DataModel",
        "ReplicatedStorage": {
          "$path": "src/ReplicatedStorage"
        },
        "ServerScriptService": {
          "$path": "src/ServerScriptService"
        },
        "StarterPlayer": {
          "StarterPlayerScripts": {
            "$path": "src/StarterPlayer/StarterPlayerScripts"
          }
        }
      }
    };

    await fs.writeJson(path.join(projDir, 'default.project.json'), defaultProjectJson, { spaces: 2 });
    await fs.outputFile(
      path.join(projDir, 'src', 'ReplicatedStorage', 'SharedModule.luau'),
      `local SharedModule = {}\n\nfunction SharedModule.init()\n    print("SharedModule initialized from external IDE!")\nend\n\nreturn SharedModule\n`
    );
    await fs.outputFile(
      path.join(projDir, 'src', 'ServerScriptService', 'GameManager.server.luau'),
      `local ReplicatedStorage = game:GetService("ReplicatedStorage")\nlocal SharedModule = require(ReplicatedStorage:WaitForChild("SharedModule"))\n\nprint("Server script running!")\nSharedModule.init()\n`
    );
    await fs.outputFile(
      path.join(projDir, 'src', 'StarterPlayer', 'StarterPlayerScripts', 'ClientMain.client.luau'),
      `print("Client main script running!")\n`
    );
    await fs.outputFile(
      path.join(projDir, '.robloxignore'),
      `*.tmp\nnode_modules/\n.git/\n`
    );

    this.log(`Created project template '${projectName}' at ${projDir}`, 'info');
    return projDir;
  }

  async loadProject() {
    if (this.watcher) {
      await this.watcher.close();
    }
    this.trackedFiles.clear();
    this.changeHistory = [];
    this.rojoParser = new RojoParser(this.activeProjectPath);
    this.projectConfig = await this.rojoParser.parseProjectConfig();

    this.log(`Loaded project configuration for '${this.activeProjectName}'`, 'info');

    await this.scanInitialFiles();
    this.startWatcher();
  }

  async switchProject(newProjectName) {
    const newPath = path.join(this.baseProjectsDir, newProjectName);
    if (!await fs.pathExists(newPath)) {
      await this.createProjectTemplate(newProjectName);
    }
    this.activeProjectName = newProjectName;
    this.activeProjectPath = newPath;
    await this.loadProject();

    this.broadcast({
      event: 'project_switched',
      projectName: this.activeProjectName,
      trackedFilesCount: this.trackedFiles.size
    });

    this.log(`Switched active project to '${this.activeProjectName}'`, 'info');
  }

  async scanInitialFiles() {
    try {
      const allFiles = await this.getFilesRecursive(this.activeProjectPath);
      for (const absPath of allFiles) {
        await this.handleFileAddOrChange(absPath, true);
      }
      this.log(`Initial scan complete: tracked ${this.trackedFiles.size} script files.`, 'info');
    } catch (err) {
      this.log(`Error during initial file scan: ${err.message}`, 'error');
    }
  }

  async getFilesRecursive(dir) {
    let results = [];
    if (!await fs.pathExists(dir)) return results;
    const list = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of list) {
      const res = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.git') {
          results = results.concat(await this.getFilesRecursive(res));
        }
      } else {
        if (entry.name.endsWith('.lua') || entry.name.endsWith('.luau')) {
          results.push(res);
        }
      }
    }
    return results;
  }

  startWatcher() {
    this.watcher = chokidar.watch(this.activeProjectPath, {
      ignored: /(^|[\/\\])\..|node_modules|\.git/,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 }
    });

    this.watcher.on('add', (absPath) => this.handleFileAddOrChange(absPath));
    this.watcher.on('change', (absPath) => this.handleFileAddOrChange(absPath));
    this.watcher.on('unlink', (absPath) => this.handleFileDelete(absPath));

    this.log(`File watcher listening at: ${this.activeProjectPath}`, 'info');
  }

  async handleFileAddOrChange(absPath, isInitial = false) {
    const relPath = path.relative(this.activeProjectPath, absPath).replace(/\\/g, '/');

    const guardTime = this.writeGuard.get(relPath);
    if (guardTime && Date.now() - guardTime < 1000) return;

    const scriptInfo = this.rojoParser.getScriptInfo(relPath, this.projectConfig.mappings);
    if (!scriptInfo) return;

    try {
      const content = await fs.readFile(absPath, 'utf-8');
      const stats = await fs.stat(absPath);
      const prevData = this.trackedFiles.get(relPath);

      if (!prevData || prevData.content !== content) {
        const fileData = {
          content,
          mtime: stats.mtimeMs,
          scriptInfo,
          absPath
        };
        this.trackedFiles.set(relPath, fileData);

        if (!isInitial) {
          const changeRecord = {
            timestamp: Date.now(),
            action: 'update',
            relPath,
            scriptInfo,
            content
          };
          this.changeHistory.push(changeRecord);
          if (this.changeHistory.length > 500) this.changeHistory.shift();

          this.log(`Updated script: ${scriptInfo.fullRobloxPath} (${scriptInfo.scriptType})`, 'sync');
          this.broadcast({ event: 'file_changed', change: changeRecord, fileData });
        }
      }
    } catch (err) {
      this.log(`Error reading ${relPath}: ${err.message}`, 'error');
    }
  }

  async handleFileDelete(absPath) {
    const relPath = path.relative(this.activeProjectPath, absPath).replace(/\\/g, '/');
    const existing = this.trackedFiles.get(relPath);
    if (!existing) return;

    this.trackedFiles.delete(relPath);

    const changeRecord = {
      timestamp: Date.now(),
      action: 'delete',
      relPath,
      scriptInfo: existing.scriptInfo
    };
    this.changeHistory.push(changeRecord);

    this.log(`Deleted script: ${existing.scriptInfo.fullRobloxPath}`, 'sync');
    this.broadcast({ event: 'file_deleted', change: changeRecord, relPath });
  }

  initExpress() {
    this.app.use(cors());
    this.app.use(express.json({ limit: '50mb' }));

    // Serve static desktop UI
    const publicPath = path.join(__dirname, '..', 'public');
    this.app.use(express.static(publicPath));

    // Studio API & Status
    this.app.get('/status', (req, res) => {
      const isConnected = Date.now() - this.lastStudioHeartbeat < 10000;
      res.json({
        activeProject: this.activeProjectName,
        activeProjectPath: this.activeProjectPath,
        baseProjectsDir: this.baseProjectsDir,
        trackedFilesCount: this.trackedFiles.size,
        studioConnected: isConnected,
        lastHeartbeat: this.lastStudioHeartbeat,
        serverTime: Date.now()
      });
    });

    this.app.get('/projects', async (req, res) => {
      try {
        const entries = await fs.readdir(this.baseProjectsDir, { withFileTypes: true });
        const projects = entries.filter(e => e.isDirectory()).map(e => e.name);
        res.json({ projects, activeProject: this.activeProjectName });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    this.app.post('/create-project', async (req, res) => {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: 'Project name required' });
      try {
        await this.createProjectTemplate(name);
        await this.switchProject(name);
        res.json({ success: true, activeProject: name });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    this.app.post('/select-project', async (req, res) => {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: 'Project name required' });
      try {
        await this.switchProject(name);
        res.json({ success: true, activeProject: name });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    this.app.get('/files', (req, res) => {
      const fileList = [];
      for (const [relPath, data] of this.trackedFiles.entries()) {
        fileList.push({
          relPath,
          content: data.content,
          scriptInfo: data.scriptInfo
        });
      }
      res.json({
        projectName: this.activeProjectName,
        files: fileList
      });
    });

    this.app.get('/changes', (req, res) => {
      const since = parseInt(req.query.since || '0', 10);
      const changes = this.changeHistory.filter(c => c.timestamp > since);
      res.json({
        timestamp: Date.now(),
        projectName: this.activeProjectName,
        changes
      });
    });

    this.app.post('/heartbeat', (req, res) => {
      const wasConnected = this.studioConnected;
      this.lastStudioHeartbeat = Date.now();
      this.studioConnected = true;

      if (!wasConnected) {
        this.log(`Roblox Studio connected to project '${this.activeProjectName}'`, 'studio');
        this.broadcast({ event: 'studio_status', connected: true, activeProject: this.activeProjectName });
      }

      res.json({ status: 'connected', activeProject: this.activeProjectName, serverTime: Date.now() });
    });

    this.app.post('/write', async (req, res) => {
      const { relPath, fullRobloxPath, scriptType, content } = req.body;
      if (!relPath || content === undefined) {
        return res.status(400).json({ error: 'relPath and content required' });
      }

      try {
        let targetRelPath = relPath;
        if (!targetRelPath.endsWith('.lua') && !targetRelPath.endsWith('.luau')) {
          const ext = scriptType === 'Script' ? '.server.luau' : (scriptType === 'LocalScript' ? '.client.luau' : '.luau');
          targetRelPath = `src/${fullRobloxPath.replace(/\./g, '/')}${ext}`;
        }

        const absPath = path.join(this.activeProjectPath, targetRelPath);
        this.writeGuard.set(targetRelPath, Date.now());
        await fs.outputFile(absPath, content, 'utf-8');

        const scriptInfo = this.rojoParser.getScriptInfo(targetRelPath, this.projectConfig.mappings) || {
          scriptName: path.basename(targetRelPath).split('.')[0],
          scriptType: scriptType || 'ModuleScript',
          fullRobloxPath: fullRobloxPath || targetRelPath,
          relPath: targetRelPath
        };

        const fileData = { content, mtime: Date.now(), scriptInfo, absPath };
        this.trackedFiles.set(targetRelPath, fileData);

        this.log(`Roblox Studio wrote file: ${targetRelPath}`, 'studio');
        this.broadcast({ event: 'file_changed', change: { action: 'update', relPath: targetRelPath, scriptInfo, content }, fileData });
        res.json({ success: true, relPath: targetRelPath });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.post('/sync-from-studio', async (req, res) => {
      const { scripts } = req.body;
      if (!Array.isArray(scripts)) {
        return res.status(400).json({ error: 'scripts array required' });
      }

      try {
        let count = 0;
        for (const s of scripts) {
          let ext = '.luau';
          if (s.scriptType === 'Script') ext = '.server.luau';
          if (s.scriptType === 'LocalScript') ext = '.client.luau';

          const relPath = `src/${s.fullRobloxPath.replace(/\./g, '/')}${ext}`;
          const absPath = path.join(this.activeProjectPath, relPath);

          this.writeGuard.set(relPath, Date.now());
          await fs.outputFile(absPath, s.content, 'utf-8');

          const scriptInfo = {
            scriptName: s.scriptName || path.basename(relPath).split('.')[0],
            scriptType: s.scriptType,
            fullRobloxPath: s.fullRobloxPath,
            relPath
          };

          const fileData = { content: s.content, mtime: Date.now(), scriptInfo, absPath };
          this.trackedFiles.set(relPath, fileData);
          count++;
        }

        this.log(`Bulk export: synced ${count} script(s) from Studio to '${this.activeProjectName}'`, 'studio');
        this.broadcast({ event: 'project_rescanned' });
        res.json({ success: true, count });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // App Control APIs
    this.app.post('/api/open-folder', (req, res) => {
      if (process.platform === 'win32') {
        exec(`explorer "${this.activeProjectPath.replace(/\//g, '\\')}"`);
      } else if (process.platform === 'darwin') {
        exec(`open "${this.activeProjectPath}"`);
      } else {
        exec(`xdg-open "${this.activeProjectPath}"`);
      }
      this.log(`Opened project directory in File Explorer`, 'info');
      res.json({ success: true });
    });

    this.app.post('/api/open-ide', (req, res) => {
      const { ide = 'vscode', customCmd = '' } = req.body || {};
      const projPath = this.activeProjectPath;
      let cmd = '';

      switch (ide) {
        case 'cursor':
          cmd = `cursor "${projPath}"`;
          break;
        case 'antigravity':
          cmd = `antigravity "${projPath}"`;
          break;
        case 'qoder':
          cmd = `qoder "${projPath}"`;
          break;
        case 'custom':
          if (customCmd) {
            const cleanCmd = customCmd.trim();
            cmd = cleanCmd.includes(' ') && !cleanCmd.startsWith('"') ? `"${cleanCmd}" "${projPath}"` : `${cleanCmd} "${projPath}"`;
          } else {
            cmd = `code "${projPath}"`;
          }
          break;
        case 'vscode':
        default:
          cmd = `code "${projPath}"`;
          break;
      }

      exec(cmd, (err) => {
        if (err) {
          if (ide !== 'vscode') {
            exec(`code "${projPath}"`, (err2) => {
              if (err2) exec(`cursor "${projPath}"`);
            });
          } else {
            exec(`cursor "${projPath}"`);
          }
          this.log(`Attempted to launch IDE command '${cmd}', fallback triggered: ${err.message}`, 'error');
        }
      });

      this.log(`Launched IDE (${ide}) using command: ${cmd}`, 'info');
      res.json({ success: true, ide, launchedCommand: cmd });
    });

    this.app.post('/api/rescan', async (req, res) => {
      await this.loadProject();
      this.broadcast({ event: 'project_rescanned' });
      this.log(`Force rescanned project files for '${this.activeProjectName}'`, 'info');
      res.json({ success: true, count: this.trackedFiles.size });
    });

    this.app.post('/api/install-plugin', async (req, res) => {
      const result = await this.ensurePluginInstalled();
      res.json(result);
    });

    this.app.get('/api/logs', (req, res) => {
      res.json({ logs: this.logs });
    });
  }

  initWebSocket() {
    this.wss.on('connection', (ws) => {
      ws.send(JSON.stringify({
        event: 'connected',
        activeProject: this.activeProjectName,
        activeProjectPath: this.activeProjectPath,
        fileCount: this.trackedFiles.size,
        studioConnected: Date.now() - this.lastStudioHeartbeat < 10000,
        logs: this.logs.slice(-50)
      }));

      ws.on('message', (msg) => {
        try {
          const data = JSON.parse(msg);
          if (data.action === 'ping') {
            ws.send(JSON.stringify({ event: 'pong' }));
          }
        } catch (e) {}
      });
    });

    // Studio disconnect monitor loop
    setInterval(() => {
      const isConnected = Date.now() - this.lastStudioHeartbeat < 10000;
      if (this.studioConnected && !isConnected) {
        this.studioConnected = false;
        this.log(`Roblox Studio disconnected (heartbeat timeout)`, 'studio');
        this.broadcast({ event: 'studio_status', connected: false, activeProject: this.activeProjectName });
      }
    }, 4000);
  }

  broadcast(data) {
    const payload = JSON.stringify(data);
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }
}

if (require.main === module) {
  const appServer = new RobloxBridgeAppServer();
  appServer.start().catch(console.error);
}

module.exports = RobloxBridgeAppServer;
