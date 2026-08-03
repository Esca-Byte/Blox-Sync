const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
const os = require('os');
const fs = require('fs-extra');
const chokidar = require('chokidar');
const RojoParser = require('./rojoParser');

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

class RobloxBridgeServer {
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

    // State tracking
    this.trackedFiles = new Map(); // relPath -> { content, mtime, scriptInfo }
    this.changeHistory = []; // { timestamp, action, relPath, scriptInfo, content }
    this.writeGuard = new Map(); // relPath -> timestamp
    this.lastStudioHeartbeat = 0;
    this.studioConnected = false;

    this.initExpress();
    this.initWebSocket();
  }

  async start() {
    await fs.ensureDir(this.baseProjectsDir);
    await this.ensureActiveProjectExists();
    await this.loadProject();

    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        console.log(`\n=================================================`);
        console.log(`🚀 Roblox Universal IDE Bridge Server v2.0.0`);
        console.log(`=================================================`);
        console.log(`📡 Listening on: http://localhost:${this.port}`);
        console.log(`📁 Projects Folder: ${this.baseProjectsDir}`);
        console.log(`🎯 Active Project: ${this.activeProjectName}`);
        console.log(`=================================================\n`);
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

    console.log(`[ProjectManager] Created project template: ${projectName} at ${projDir}`);
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

    console.log(`[ProjectLoader] Loaded project config for '${this.activeProjectName}'`);

    // Scan initial files
    await this.scanInitialFiles();

    // Start File Watcher
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
      projectName: this.activeProjectName
    });
  }

  async scanInitialFiles() {
    try {
      const allFiles = await this.getFilesRecursive(this.activeProjectPath);
      for (const absPath of allFiles) {
        await this.handleFileAddOrChange(absPath, true);
      }
      console.log(`[ProjectLoader] Initial scan complete: tracked ${this.trackedFiles.size} script files.`);
    } catch (err) {
      console.error(`[ProjectLoader] Error during initial file scan:`, err);
    }
  }

  async getFilesRecursive(dir) {
    let results = [];
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
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      }
    });

    this.watcher.on('add', (absPath) => this.handleFileAddOrChange(absPath));
    this.watcher.on('change', (absPath) => this.handleFileAddOrChange(absPath));
    this.watcher.on('unlink', (absPath) => this.handleFileDelete(absPath));

    console.log(`[FileWatcher] Watching directory: ${this.activeProjectPath}`);
  }

  async handleFileAddOrChange(absPath, isInitial = false) {
    const relPath = path.relative(this.activeProjectPath, absPath).replace(/\\/g, '/');

    // Check write guard to prevent loop if written by Studio
    const guardTime = this.writeGuard.get(relPath);
    if (guardTime && Date.now() - guardTime < 1000) {
      return;
    }

    const scriptInfo = this.rojoParser.getScriptInfo(relPath, this.projectConfig.mappings);
    if (!scriptInfo) return; // ignore non-script files

    try {
      const content = await fs.readFile(absPath, 'utf-8');
      const stats = await fs.stat(absPath);
      const prevData = this.trackedFiles.get(relPath);

      if (!prevData || prevData.content !== content) {
        this.trackedFiles.set(relPath, {
          content,
          mtime: stats.mtimeMs,
          scriptInfo,
          absPath
        });

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

          console.log(`[FileWatcher] Updated script: ${scriptInfo.fullRobloxPath} (${scriptInfo.scriptType})`);
          this.broadcast({ event: 'file_changed', change: changeRecord });
        }
      }
    } catch (err) {
      console.error(`[FileWatcher] Error reading ${relPath}:`, err.message);
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

    console.log(`[FileWatcher] Deleted script: ${existing.scriptInfo.fullRobloxPath}`);
    this.broadcast({ event: 'file_deleted', change: changeRecord });
  }

  initExpress() {
    this.app.use(cors());
    this.app.use(express.json({ limit: '50mb' }));

    // Health & Info
    this.app.get('/', (req, res) => {
      res.json({ status: 'ok', server: 'Roblox Universal IDE Bridge Server', version: '2.0.0' });
    });

    this.app.get('/status', (req, res) => {
      res.json({
        activeProject: this.activeProjectName,
        activeProjectPath: this.activeProjectPath,
        trackedFilesCount: this.trackedFiles.size,
        studioConnected: Date.now() - this.lastStudioHeartbeat < 10000,
        lastHeartbeat: this.lastStudioHeartbeat
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

    // Studio Sync API Endpoints
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
      this.lastStudioHeartbeat = Date.now();
      this.studioConnected = true;
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

        // Update tracking
        const scriptInfo = this.rojoParser.getScriptInfo(targetRelPath, this.projectConfig.mappings) || {
          scriptName: path.basename(targetRelPath).split('.')[0],
          scriptType: scriptType || 'ModuleScript',
          fullRobloxPath: fullRobloxPath || targetRelPath,
          relPath: targetRelPath
        };

        this.trackedFiles.set(targetRelPath, {
          content,
          mtime: Date.now(),
          scriptInfo,
          absPath
        });

        console.log(`[StudioWrite] Written file to disk: ${targetRelPath}`);
        res.json({ success: true, relPath: targetRelPath });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.post('/delete-from-studio', async (req, res) => {
      const { relPath } = req.body;
      if (!relPath) return res.status(400).json({ error: 'relPath required' });

      try {
        const absPath = path.join(this.activeProjectPath, relPath);
        if (await fs.pathExists(absPath)) {
          this.writeGuard.set(relPath, Date.now());
          await fs.remove(absPath);
          this.trackedFiles.delete(relPath);
          console.log(`[StudioDelete] Deleted file from disk: ${relPath}`);
        }
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.post('/sync-from-studio', async (req, res) => {
      const { scripts } = req.body; // Array of { fullRobloxPath, scriptType, content }
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

          this.trackedFiles.set(relPath, {
            content: s.content,
            mtime: Date.now(),
            scriptInfo,
            absPath
          });
          count++;
        }

        console.log(`[BulkExport] Exported ${count} scripts from Studio to ${this.activeProjectName}`);
        res.json({ success: true, count });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
  }

  initWebSocket() {
    this.wss.on('connection', (ws) => {
      console.log('[WebSocket] Client connected.');
      ws.send(JSON.stringify({
        event: 'connected',
        activeProject: this.activeProjectName,
        fileCount: this.trackedFiles.size
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
  const server = new RobloxBridgeServer();
  server.start().catch(console.error);
}

module.exports = RobloxBridgeServer;
