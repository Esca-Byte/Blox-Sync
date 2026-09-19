document.addEventListener('DOMContentLoaded', () => {
  // ─── DOM Elements ───────────────────────────────────────────────────────
  const projectSelect        = document.getElementById('projectSelect');
  const btnNewProject        = document.getElementById('btnNewProject');
  const btnOpenIDE           = document.getElementById('btnOpenIDE');
  const btnOpenFolder        = document.getElementById('btnOpenFolder');
  const btnRescan            = document.getElementById('btnRescan');
  const btnRenameProject     = document.getElementById('btnRenameProject');
  const btnDeleteProject     = document.getElementById('btnDeleteProject');

  const statActiveProject    = document.getElementById('statActiveProject');
  const statStudioStatus     = document.getElementById('statStudioStatus');
  const studioPulse          = document.getElementById('studioPulse');
  const statTrackedCount     = document.getElementById('statTrackedCount');
  const statUptime           = document.getElementById('statUptime');
  const statCardFiles        = document.getElementById('statCardFiles');

  const consoleLog           = document.getElementById('consoleLog');
  const btnClearConsole      = document.getElementById('btnClearConsole');
  const btnExportLog         = document.getElementById('btnExportLog');
  const consoleStatusPill    = document.getElementById('consoleStatusPill');

  // ─ Path B: Luau Runner ───────────────────────────────────────────────
  const runnerCode           = document.getElementById('runnerCode');
  const runnerOutput         = document.getElementById('runnerOutput');
  const btnRunLuau           = document.getElementById('btnRunLuau');
  const btnClearRunner       = document.getElementById('btnClearRunner');
  const runnerStatusPill     = document.getElementById('runnerStatusPill');
  const runnerJobStatus      = document.getElementById('runnerJobStatus');

  // ─ Path B: Game Explorer ────────────────────────────────────────────
  const explorerTree         = document.getElementById('explorerTree');
  const explorerTimestamp    = document.getElementById('explorerTimestamp');
  const btnRefreshTree       = document.getElementById('btnRefreshTree');

  // ─ Path B: Tab Bar ────────────────────────────────────────────────
  const tabConsole           = document.getElementById('tabConsole');
  const tabRunner            = document.getElementById('tabRunner');
  const tabExplorer          = document.getElementById('tabExplorer');
  const panelConsole         = document.getElementById('panelConsole');
  const panelRunner          = document.getElementById('panelRunner');
  const panelExplorer        = document.getElementById('panelExplorer');

  // ─ Launch Roblox Studio ───────────────────────────────────────────────
  const btnOpenStudio        = document.getElementById('btnOpenStudio');

  // ─ Feature 1: .rbxlx Export ──────────────────────────────────────────
  const btnExportRbxlx       = document.getElementById('btnExportRbxlx');

  // ─ Feature 2: Conflict Modal ─────────────────────────────────────────
  const modalConflict        = document.getElementById('modalConflict');
  const conflictFilePath     = document.getElementById('conflictFilePath');
  const conflictIdeContent   = document.getElementById('conflictIdeContent');
  const conflictStudioContent= document.getElementById('conflictStudioContent');
  const btnConflictIde       = document.getElementById('btnConflictIde');
  const btnConflictStudio    = document.getElementById('btnConflictStudio');
  const btnConflictClose     = document.getElementById('btnConflictClose');
  let   activeConflictPath   = null;

  // ─ Feature 6: Wally ──────────────────────────────────────────────────
  const btnWallyInstall      = document.getElementById('btnWallyInstall');

  // ─ Feature 7: TypeScript ──────────────────────────────────────────────
  const btnTsCompile         = document.getElementById('btnTsCompile');
  const statCardTs           = document.getElementById('statCardTs');
  const statTsStatus         = document.getElementById('statTsStatus');

  // Create Project Modal
  const modalCreateProject      = document.getElementById('modalCreateProject');
  const inputProjectName        = document.getElementById('inputProjectName');
  const btnCloseModal           = document.getElementById('btnCloseModal');
  const btnCancelModal          = document.getElementById('btnCancelModal');
  const btnSubmitCreateProject  = document.getElementById('btnSubmitCreateProject');

  // Rename Modal
  const modalRenameProject      = document.getElementById('modalRenameProject');
  const inputRenameProject      = document.getElementById('inputRenameProject');
  const btnCloseRenameModal     = document.getElementById('btnCloseRenameModal');
  const btnCancelRenameModal    = document.getElementById('btnCancelRenameModal');
  const btnSubmitRenameProject  = document.getElementById('btnSubmitRenameProject');

  // Delete Confirm Modal
  const modalDeleteProject      = document.getElementById('modalDeleteProject');
  const deleteProjectNameLabel  = document.getElementById('deleteProjectNameLabel');
  const btnCloseDeleteModal     = document.getElementById('btnCloseDeleteModal');
  const btnCancelDeleteModal    = document.getElementById('btnCancelDeleteModal');
  const btnConfirmDeleteProject = document.getElementById('btnConfirmDeleteProject');

  // ── Frameless Titlebar & Window Chrome ──
  const titlebarWindowTitle   = document.getElementById('titlebarWindowTitle');
  const titlebarProjectName   = document.getElementById('titlebarProjectName');
  const titlebarStudioBadge   = document.getElementById('titlebarStudioBadge');
  const titlebarPulse         = document.getElementById('titlebarPulse');
  const titlebarStudioText    = document.getElementById('titlebarStudioText');
  const btnWinMin             = document.getElementById('btnWinMin');
  const btnWinMax             = document.getElementById('btnWinMax');
  const btnWinClose           = document.getElementById('btnWinClose');

  // ── Enhanced Panel Actions ──
  const runnerSnippetSelect   = document.getElementById('runnerSnippetSelect');
  const btnCopyRunnerOutput   = document.getElementById('btnCopyRunnerOutput');
  const btnCopyConsole        = document.getElementById('btnCopyConsole');
  const consoleFilterGroup    = document.getElementById('consoleFilterGroup');
  const explorerSearchInput   = document.getElementById('explorerSearchInput');
  const btnExpandAllTree      = document.getElementById('btnExpandAllTree');
  const btnCollapseAllTree    = document.getElementById('btnCollapseAllTree');

  // ─── State ──────────────────────────────────────────────────────────────
  let ws = null;
  let trackedFiles   = [];
  let projectsList   = [];
  let currentProject = '';
  let serverStartTime = null;
  let uptimeInterval  = null;
  let activeConsoleFilter = 'all';

  // ─── Initialize ─────────────────────────────────────────────────────────
  setupDesktopControls();
  setupEnhancedUX();
  initWebSocket();
  fetchInitialData();
  setupEventListeners();
  initMcpSetup();

  // ═══════════════════════════════════════════════════════════════════════
  // WebSocket
  // ═══════════════════════════════════════════════════════════════════════
  function initWebSocket() {
    const wsUrl = `ws://${window.location.host}`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      appendConsoleLog('Connected to Blox Sync WebSocket Server', 'info');
      setWsBadge('connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleServerEvent(data);
      } catch (e) {
        console.error('WS parse error:', e);
      }
    };

    ws.onclose = () => {
      setWsBadge('disconnected');
      appendConsoleLog('WebSocket disconnected. Retrying in 3s...', 'error');
      setWsBadge('reconnecting');
      setTimeout(initWebSocket, 3000);
    };
  }

  function setWsBadge(state) {
    if (!consoleStatusPill) return;
    consoleStatusPill.className = 'badge';
    if (state === 'connected') {
      consoleStatusPill.textContent = 'WS Connected';
      consoleStatusPill.classList.add('badge-success');
    } else if (state === 'reconnecting') {
      consoleStatusPill.textContent = 'Reconnecting...';
      consoleStatusPill.classList.add('badge-warn');
    } else {
      consoleStatusPill.textContent = 'WS Disconnected';
      consoleStatusPill.classList.add('badge-error');
    }
  }

  function handleServerEvent(data) {
    switch (data.event) {
      case 'connected':
        currentProject = data.activeProject;
        if (data.serverStartTime) {
          serverStartTime = data.serverStartTime;
          startUptimeCounter();
        }
        updateStatusCards(data);
        if (data.logs) {
          data.logs.forEach(l => appendConsoleLog(l.message, l.type, l.timestamp));
        }
        fetchFiles();
        fetchProjects();
        checkProjectFeatures();
        break;

      case 'log_entry':
        if (data.entry) {
          appendConsoleLog(data.entry.message, data.entry.type, data.entry.timestamp);
        }
        break;

      case 'studio_status':
        updateStudioStatus(data.connected, data.activeProject);
        updateRunnerPill(data.connected);
        if (data.connected) {
          showToast('Roblox Studio connected', 'success');
          fetchTree(); // PATH B: load tree on connect
        } else {
          showToast('Roblox Studio disconnected', 'error');
        }
        break;

      case 'file_changed':
        fetchFiles();
        pulseFileCard();
        break;

      case 'file_deleted':
        fetchFiles();
        pulseFileCard();
        break;

      case 'project_switched':
        currentProject = data.projectName;
        if (statActiveProject) statActiveProject.textContent = data.projectName;
        fetchFiles();
        fetchProjects();
        checkProjectFeatures();
        showToast(`Switched to project: ${data.projectName}`, 'info');
        break;

      case 'project_rescanned':
        fetchFiles();
        showToast('Project rescanned', 'info');
        break;

      // ── PATH B events ─────────────────────────────────────────────────────
      case 'execute_result':
        if (data.result) appendRunnerResult(data.result);
        break;

      case 'tree_update':
        if (data.tree) renderExplorerTree(data.tree, data.timestamp);
        break;

      case 'studio_log':
        if (data.entry) appendStudioLog(data.entry);
        break;

      // ── New Feature events ────────────────────────────────────────────────
      case 'file_conflict':
        openConflictModal(data);
        break;

      case 'conflict_resolved':
        if (modalConflict) modalConflict.classList.add('hidden');
        showToast(`Conflict resolved (${data.resolution === 'ide' ? 'IDE' : 'Studio'} version kept): ${data.relPath}`, 'success');
        break;

      case 'file_renamed':
        fetchFiles();
        showToast(`Renamed: ${data.change?.oldRelPath} → ${data.change?.relPath}`, 'info');
        break;

      case 'wally_install_start':
        if (btnWallyInstall) btnWallyInstall.classList.add('loading');
        showToast('Wally: Installing packages...', 'info');
        break;

      case 'wally_install_result':
        if (btnWallyInstall) btnWallyInstall.classList.remove('loading');
        if (data.success) {
          showToast('Wally: Package install complete', 'success');
        } else {
          showToast(`Wally: Install failed: ${(data.output || '').slice(0, 80)}`, 'error');
        }
        break;

      case 'ts_compile_start':
        if (btnTsCompile) btnTsCompile.classList.add('ts-compiling');
        if (statTsStatus) statTsStatus.textContent = 'Compiling…';
        break;

      case 'ts_compile_result':
        if (btnTsCompile) btnTsCompile.classList.remove('ts-compiling');
        if (statTsStatus) {
          statTsStatus.textContent = data.success ? 'Build OK' : 'Build Error';
          statTsStatus.style.color = data.success ? 'var(--accent-green)' : 'var(--accent-red)';
        }
        showToast(data.success ? 'TypeScript compiled successfully' : `TypeScript build error: ${(data.output || '').slice(0, 80)}`, data.success ? 'success' : 'error');
        break;

      case 'mcp_install_progress': {
        const p = data.data || {};
        const bar    = document.getElementById('mcpProgressBar');
        const pct    = document.getElementById('mcpProgressPct');
        const file   = document.getElementById('mcpProgressFile');
        const status = document.getElementById('mcpProgressStatus');
        if (bar)  bar.style.width  = `${p.percent || 0}%`;
        if (pct)  pct.textContent  = `${p.percent || 0}%`;
        if (file) file.textContent = p.file || '';
        if (status) {
          if (p.phase === 'npm') {
            status.textContent = 'Installing npm packages...';
          } else if (p.total) {
            status.textContent = `Copying files... (${p.copied}/${p.total})`;
          } else {
            status.textContent = 'Scanning...';
          }
        }
        break;
      }

      case 'mcp_install_complete': {
        const d = data.data || {};
        const progressSection = document.getElementById('mcpProgressSection');
        const doneSection     = document.getElementById('mcpDoneSection');
        const doneMsg         = document.getElementById('mcpDoneMessage');
        const actionsInstall  = document.getElementById('mcpSetupActions');
        const actionsDone     = document.getElementById('mcpSetupDoneActions');
        if (progressSection) progressSection.classList.add('hidden');
        if (doneSection)     doneSection.classList.remove('hidden');
        if (actionsInstall)  actionsInstall.classList.add('hidden');
        if (actionsDone)     actionsDone.classList.remove('hidden');
        if (d.success) {
          const ides = (d.configuredIDEs || []).join(', ');
          if (doneMsg) doneMsg.textContent = ides
            ? `MCP installed! Configured for: ${ides}`
            : 'MCP installed successfully!';
        } else {
          const doneIcon = document.querySelector('.mcp-done-icon');
          if (doneIcon) doneIcon.textContent = '⚠️';
          if (doneMsg)  doneMsg.style.color = 'var(--accent-amber)';
          if (doneMsg)  doneMsg.textContent  = `Install failed: ${d.error || 'unknown error'}`;
        }
        break;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // REST API
  // ═══════════════════════════════════════════════════════════════════════
  async function fetchInitialData() {
    try {
      const res  = await fetch('/status');
      const data = await res.json();
      currentProject = data.activeProject;
      if (data.serverStartTime) {
        serverStartTime = data.serverStartTime;
        startUptimeCounter();
      }
      updateStatusCards(data);
      fetchProjects();
      fetchFiles();
      checkPendingConflicts();
      checkProjectFeatures();
    } catch (e) {
      console.error('Fetch status failed:', e);
    }
  }

  async function fetchProjects() {
    try {
      const res  = await fetch('/projects');
      const data = await res.json();
      projectsList = data.projects || [];
      renderProjectsSelect(data.projects, data.activeProject);
    } catch (e) {
      console.error('Fetch projects failed:', e);
    }
  }

  async function fetchFiles() {
    try {
      const res  = await fetch('/files');
      const data = await res.json();
      trackedFiles = data.files || [];
      if (statTrackedCount) statTrackedCount.textContent = trackedFiles.length;
    } catch (e) {
      console.error('Fetch files failed:', e);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Renderers & Helpers
  // ═══════════════════════════════════════════════════════════════════════
  function renderProjectsSelect(projects, active) {
    projectSelect.innerHTML = '';
    if (!projects || projects.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No projects found';
      opt.disabled = true;
      projectSelect.appendChild(opt);
      return;
    }
    projects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      if (p === active) opt.selected = true;
      projectSelect.appendChild(opt);
    });
  }

  function showToast(message, type = 'info') {
    let toast = document.getElementById('toastNotice');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toastNotice';
      toast.className = 'toast-notice';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = `toast-notice toast-${type} show`;
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  function updateStatusCards(data) {
    if (data.activeProject) {
      if (statActiveProject) statActiveProject.textContent = data.activeProject;
      if (titlebarProjectName) titlebarProjectName.textContent = data.activeProject;
      if (titlebarWindowTitle) titlebarWindowTitle.textContent = `${data.activeProject} — Blox Sync`;
    }
    if (data.trackedFilesCount !== undefined && statTrackedCount) {
      statTrackedCount.textContent = data.trackedFilesCount;
    }
    updateStudioStatus(data.studioConnected, data.activeProject);
  }

  function updateStudioStatus(connected) {
    if (connected) {
      if (statStudioStatus) {
        statStudioStatus.textContent = 'Connected';
        statStudioStatus.className = 'stat-value status-online';
      }
      if (studioPulse) studioPulse.className = 'pulse-dot online';
      if (titlebarPulse) titlebarPulse.className = 'pulse-dot online';
      if (titlebarStudioText) titlebarStudioText.textContent = 'Studio Connected';
      if (titlebarStudioBadge) titlebarStudioBadge.className = 'badge badge-success';
    } else {
      if (statStudioStatus) {
        statStudioStatus.textContent = 'Disconnected';
        statStudioStatus.className = 'stat-value status-offline';
      }
      if (studioPulse) studioPulse.className = 'pulse-dot offline';
      if (titlebarPulse) titlebarPulse.className = 'pulse-dot offline';
      if (titlebarStudioText) titlebarStudioText.textContent = 'Studio Offline';
      if (titlebarStudioBadge) titlebarStudioBadge.className = 'badge badge-error';
    }
  }

  function appendConsoleLog(msg, type = 'info', timestamp = Date.now()) {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;

    const timeStr = new Date(timestamp).toLocaleTimeString();

    // SuperbulletFramework-inspired: richer error display
    if (type === 'error') {
      entry.innerHTML = `
        <span class="log-timestamp">[${timeStr}]</span>
        <span class="log-tag tag-${type}">${type}</span>
        <span class="log-message log-error-msg">${escapeHtml(msg)}</span>
      `;
    } else {
      entry.innerHTML = `
        <span class="log-timestamp">[${timeStr}]</span>
        <span class="log-tag tag-${type}">${type}</span>
        <span class="log-message">${escapeHtml(msg)}</span>
      `;
    }

    if (activeConsoleFilter !== 'all') {
      const isPrint = type === 'info' || type === 'sync' || type === 'print';
      const show = (activeConsoleFilter === 'print' && isPrint) ||
                   (activeConsoleFilter === 'warn' && type === 'warn') ||
                   (activeConsoleFilter === 'error' && type === 'error');
      entry.style.display = show ? '' : 'none';
    }

    consoleLog.appendChild(entry);
    consoleLog.scrollTop = consoleLog.scrollHeight;

    // Cap log entries at 500
    const entries = consoleLog.querySelectorAll('.log-entry');
    if (entries.length > 500) entries[0].remove();
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function pulseFileCard() {
    if (!statCardFiles) return;
    statCardFiles.classList.remove('file-sync-pulse');
    void statCardFiles.offsetWidth; // reflow
    statCardFiles.classList.add('file-sync-pulse');
    setTimeout(() => statCardFiles.classList.remove('file-sync-pulse'), 700);
  }

  function startUptimeCounter() {
    if (uptimeInterval) clearInterval(uptimeInterval);
    uptimeInterval = setInterval(() => {
      if (!serverStartTime || !statUptime) return;
      const elapsed = Math.floor((Date.now() - serverStartTime) / 1000);
      const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
      const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
      const s = String(elapsed % 60).padStart(2, '0');
      statUptime.textContent = `${h}:${m}:${s}`;
    }, 1000);
  }

  function exportLog() {
    const entries = consoleLog.querySelectorAll('.log-entry');
    const lines = [];
    entries.forEach(entry => {
      const time  = entry.querySelector('.log-timestamp')?.textContent || '';
      const tag   = entry.querySelector('.log-tag')?.textContent || '';
      const msg   = entry.querySelector('.log-message')?.textContent || '';
      lines.push(`${time} [${tag.toUpperCase()}] ${msg}`);
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `blox-sync-log-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Log exported', 'success');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Event Listeners
  // ═══════════════════════════════════════════════════════════════════════
  function setupEventListeners() {

    // ── Project Dropdown ──
    projectSelect.addEventListener('change', async () => {
      const selected = projectSelect.value;
      if (!selected) return;
      try {
        const res = await fetch('/switch-project', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project: selected })
        });
        if (res.ok) {
          currentProject = selected;
          showToast(`Switched to: ${selected}`, 'info');
          fetchFiles();
        }
      } catch (e) {
        console.error('Switch project error:', e);
      }
    });

    // ── Create Project Modal ──
    btnNewProject.addEventListener('click', () => {
      inputProjectName.value = '';
      modalCreateProject.classList.remove('hidden');
      inputProjectName.focus();
    });

    btnCloseModal.addEventListener('click', () => modalCreateProject.classList.add('hidden'));
    btnCancelModal.addEventListener('click', () => modalCreateProject.classList.add('hidden'));

    // Enter key in project name field
    inputProjectName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') btnSubmitCreateProject.click();
    });

    btnSubmitCreateProject.addEventListener('click', async () => {
      const name = inputProjectName.value.trim();
      if (!name) {
        showToast('Please enter a project name', 'error');
        return;
      }
      const templateRadio = document.querySelector('input[name="projectTemplate"]:checked');
      const template = templateRadio ? templateRadio.value : 'standard';

      modalCreateProject.classList.add('hidden');
      inputProjectName.value = '';

      const res = await fetch('/create-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, template })
      });
      if (res.ok) {
        const templateLabel = template === 'knit' ? 'Knit Framework' : 'Standard';
        showToast(`Created project: ${name} (${templateLabel})`, 'success');
        fetchProjects();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(`Create failed: ${err.error || 'unknown error'}`, 'error');
      }
    });

    // ── Rename Project Modal ──
    btnRenameProject.addEventListener('click', () => {
      inputRenameProject.value = currentProject;
      modalRenameProject.classList.remove('hidden');
      inputRenameProject.select();
    });

    btnCloseRenameModal.addEventListener('click', () => modalRenameProject.classList.add('hidden'));
    btnCancelRenameModal.addEventListener('click', () => modalRenameProject.classList.add('hidden'));

    inputRenameProject.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') btnSubmitRenameProject.click();
    });

    btnSubmitRenameProject.addEventListener('click', async () => {
      const newName = inputRenameProject.value.trim();
      if (!newName || newName === currentProject) {
        modalRenameProject.classList.add('hidden');
        return;
      }
      modalRenameProject.classList.add('hidden');

      const res = await fetch('/rename-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldName: currentProject, newName })
      });
      if (res.ok) {
        showToast(`Renamed to: ${newName}`, 'success');
        fetchProjects();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(`Rename failed: ${err.error || 'unknown error'}`, 'error');
      }
    });

    // ── Delete Project Modal ──
    btnDeleteProject.addEventListener('click', () => {
      if (deleteProjectNameLabel) deleteProjectNameLabel.textContent = `"${currentProject}"`;
      modalDeleteProject.classList.remove('hidden');
    });

    btnCloseDeleteModal.addEventListener('click', () => modalDeleteProject.classList.add('hidden'));
    btnCancelDeleteModal.addEventListener('click', () => modalDeleteProject.classList.add('hidden'));

    btnConfirmDeleteProject.addEventListener('click', async () => {
      const nameToDelete = currentProject;
      modalDeleteProject.classList.add('hidden');

      const res = await fetch('/delete-project', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameToDelete })
      });
      if (res.ok) {
        const data = await res.json();
        showToast(`Deleted "${nameToDelete}". Active: ${data.activeProject}`, 'success');
        fetchProjects();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(`Delete failed: ${err.error || 'unknown error'}`, 'error');
      }
    });

    // ── Open Folder ──
    btnOpenFolder.addEventListener('click', () => {
      fetch('/api/open-folder', { method: 'POST' });
    });

    // ── Rescan ──
    btnRescan.addEventListener('click', async () => {
      await fetch('/api/rescan', { method: 'POST' });
      showToast('Rescanning project files...', 'info');
    });

    // ── Console Buttons ──
    btnClearConsole.addEventListener('click', () => {
      consoleLog.innerHTML = '';
    });

    btnExportLog.addEventListener('click', exportLog);

    // ── IDE Preference Management ──
    const getSavedIDE       = () => localStorage.getItem('roblox_bridge_ide') || 'antigravity';
    const getSavedCustomCmd = () => localStorage.getItem('roblox_bridge_custom_ide') || '';

    const updateIDELabel = () => {
      const saved    = getSavedIDE();
      const txtOpenIDE = document.getElementById('txtOpenIDE');
      if (!txtOpenIDE) return;
      const names = {
        vscode:      'Open VS Code',
        cursor:      'Open Cursor',
        antigravity: 'Open Antigravity',
        qoder:       'Open Qoder',
        custom:      'Open Custom IDE'
      };
      txtOpenIDE.textContent = names[saved] || 'Open Antigravity';
    };

    updateIDELabel();

    const launchIDE = (ideChoice, customCmd = '') => {
      const chkSetDefaultIDE = document.getElementById('chkSetDefaultIDE');
      if (chkSetDefaultIDE && chkSetDefaultIDE.checked) {
        localStorage.setItem('roblox_bridge_ide', ideChoice);
        if (ideChoice === 'custom' && customCmd) {
          localStorage.setItem('roblox_bridge_custom_ide', customCmd);
        }
        updateIDELabel();
      }

      fetch('/api/open-ide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ide: ideChoice, customCmd })
      });

      const modalSelectIDE = document.getElementById('modalSelectIDE');
      if (modalSelectIDE) modalSelectIDE.classList.add('hidden');
    };

    btnOpenIDE.addEventListener('click', () => {
      const savedIDE    = getSavedIDE();
      const savedCustom = getSavedCustomCmd();
      launchIDE(savedIDE, savedCustom);
    });

    const btnSelectIDE   = document.getElementById('btnSelectIDE');
    const modalSelectIDE = document.getElementById('modalSelectIDE');
    const btnCloseIDEModal  = document.getElementById('btnCloseIDEModal');
    const btnCancelIDEModal = document.getElementById('btnCancelIDEModal');

    if (btnSelectIDE && modalSelectIDE) {
      btnSelectIDE.addEventListener('click', () => {
        const inputCustomIDE = document.getElementById('inputCustomIDE');
        if (inputCustomIDE) inputCustomIDE.value = getSavedCustomCmd();
        modalSelectIDE.classList.remove('hidden');
      });
    }

    if (btnCloseIDEModal && modalSelectIDE) {
      btnCloseIDEModal.addEventListener('click', () => modalSelectIDE.classList.add('hidden'));
    }
    if (btnCancelIDEModal && modalSelectIDE) {
      btnCancelIDEModal.addEventListener('click', () => modalSelectIDE.classList.add('hidden'));
    }
    if (modalSelectIDE) {
      modalSelectIDE.addEventListener('click', (e) => {
        if (e.target === modalSelectIDE) modalSelectIDE.classList.add('hidden');
      });
    }

    document.querySelectorAll('.btn-launch-ide').forEach(btn => {
      btn.addEventListener('click', () => {
        const ide = btn.getAttribute('data-ide');
        launchIDE(ide);
      });
    });

    const btnLaunchCustomIDE = document.getElementById('btnLaunchCustomIDE');
    if (btnLaunchCustomIDE) {
      btnLaunchCustomIDE.addEventListener('click', () => {
        const inputCustomIDE = document.getElementById('inputCustomIDE');
        const customCmd = inputCustomIDE ? inputCustomIDE.value.trim() : '';
        if (customCmd) {
          launchIDE('custom', customCmd);
        } else {
          showToast('Please enter a custom CLI command or executable path', 'error');
        }
      });
    }

    // ── Launch Roblox Studio ──
    if (btnOpenStudio) {
      btnOpenStudio.addEventListener('click', async () => {
        showToast('Launching Roblox Studio...', 'info');
        try {
          const res = await fetch('/api/open-studio', { method: 'POST' });
          const data = await res.json().catch(() => ({}));
          if (res.ok) {
            showToast('Roblox Studio launched successfully', 'success');
          } else {
            showToast(`Failed to launch Studio: ${data.error || 'Unknown error'}`, 'error');
          }
        } catch (e) {
          showToast(`Failed to launch Studio: ${e.message}`, 'error');
        }
      });
    }

    // ── Feature 1: .rbxlx Export ──
    if (btnExportRbxlx) {
      btnExportRbxlx.addEventListener('click', exportRbxlx);
    }

    // ── Feature 2: Conflict Resolution ──
    if (btnConflictIde) {
      btnConflictIde.addEventListener('click', () => resolveConflict('ide'));
    }
    if (btnConflictStudio) {
      btnConflictStudio.addEventListener('click', () => resolveConflict('studio'));
    }
    if (btnConflictClose) {
      btnConflictClose.addEventListener('click', () => {
        if (modalConflict) modalConflict.classList.add('hidden');
      });
    }

    // ── Feature 6: Wally Package Manager ──
    if (btnWallyInstall) {
      btnWallyInstall.addEventListener('click', wallyInstall);
    }

    // ── Feature 7: TypeScript Manual Compile ──
    if (btnTsCompile) {
      btnTsCompile.addEventListener('click', tsCompile);
    }

    // ── Click outside to close modals ──
    [modalCreateProject, modalRenameProject, modalDeleteProject, modalConflict].forEach(modal => {
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) modal.classList.add('hidden');
        });
      }
    });

    // ── Keyboard: Escape closes all modals, Enter submits focused modal ──
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        modalCreateProject?.classList.add('hidden');
        modalRenameProject?.classList.add('hidden');
        modalDeleteProject?.classList.add('hidden');
        modalConflict?.classList.add('hidden');
        document.getElementById('modalSelectIDE')?.classList.add('hidden');
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PATH B — Tab Switching
  // ═══════════════════════════════════════════════════════════════════════════
  function switchTab(name) {
    const tabMap   = { console: tabConsole,   runner: tabRunner,   explorer: tabExplorer };
    const panelMap = { console: panelConsole, runner: panelRunner, explorer: panelExplorer };
    Object.entries(tabMap).forEach(([k, el]) => {
      if (!el) return;
      el.classList.toggle('active', k === name);
    });
    Object.entries(panelMap).forEach(([k, el]) => {
      if (!el) return;
      el.classList.toggle('active', k === name);
      el.classList.toggle('hidden',  k !== name);
    });
  }
  if (tabConsole)  tabConsole.addEventListener('click',  () => switchTab('console'));
  if (tabRunner)   tabRunner.addEventListener('click',   () => switchTab('runner'));
  if (tabExplorer) tabExplorer.addEventListener('click', () => switchTab('explorer'));

  // ═══════════════════════════════════════════════════════════════════════════
  // PATH B — Luau Runner
  // ═══════════════════════════════════════════════════════════════════════════
  function updateRunnerPill(studioConnected) {
    if (!runnerStatusPill) return;
    if (studioConnected) {
      runnerStatusPill.className = 'badge badge-success';
      runnerStatusPill.textContent = 'Studio Connected';
    } else {
      runnerStatusPill.className = 'badge badge-warn';
      runnerStatusPill.textContent = 'Studio Required';
    }
  }

  function setRunnerJobStatus(state, msg) {
    if (!runnerJobStatus) return;
    runnerJobStatus.className = 'runner-job-status ' + (state || '');
    runnerJobStatus.textContent = msg || 'Ready';
  }

  function appendRunnerResult(result) {
    if (!runnerOutput) return;
    const isOk  = result.success;
    const entry = document.createElement('div');
    entry.className = `runner-result-entry ${isOk ? 'success' : 'error'}`;
    const time = new Date(result.timestamp || Date.now()).toLocaleTimeString();
    entry.innerHTML = `
      <div class="runner-result-header">
        <span class="runner-result-badge ${isOk ? 'ok' : 'err'}">${isOk ? 'OK' : 'ERR'}</span>
        <span>Job #${result.jobId}</span>
        <span>${result.executionTime ?? '?'}ms</span>
        <span style="margin-left:auto">${time}</span>
      </div>
      <div class="runner-result-output">${escapeHtml(isOk ? (result.output || '(no output)') : (result.error || 'Unknown error'))}</div>
    `;
    runnerOutput.appendChild(entry);
    runnerOutput.scrollTop = runnerOutput.scrollHeight;
    setRunnerJobStatus(isOk ? 'success' : 'error', isOk ? `Job #${result.jobId} completed` : `Job #${result.jobId} failed`);
    if (btnRunLuau) { btnRunLuau.classList.remove('running'); btnRunLuau.disabled = false; }
  }

  async function executeCode() {
    const code = runnerCode?.value?.trim();
    if (!code) { showToast('Enter Luau code to execute', 'error'); return; }
    if (btnRunLuau) { btnRunLuau.classList.add('running'); btnRunLuau.disabled = true; }
    setRunnerJobStatus('running', 'Sending to Studio…');
    try {
      const res  = await fetch('/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, context: 'Desktop Runner' })
      });
      const data = await res.json();
      if (!res.ok) {
        setRunnerJobStatus('error', data.error || 'Execute failed');
        showToast(data.error || 'Execute failed', 'error');
        if (btnRunLuau) { btnRunLuau.classList.remove('running'); btnRunLuau.disabled = false; }
      } else {
        setRunnerJobStatus('running', `Job #${data.jobId} queued…`);
        showToast(`Job #${data.jobId} queued in Studio`, 'info');
      }
    } catch (e) {
      setRunnerJobStatus('error', 'Network error');
      showToast('Network error — verify bridge server is active', 'error');
      if (btnRunLuau) { btnRunLuau.classList.remove('running'); btnRunLuau.disabled = false; }
    }
  }

  if (btnRunLuau)    btnRunLuau.addEventListener('click', executeCode);
  if (btnClearRunner) btnClearRunner.addEventListener('click', () => {
    if (runnerOutput) runnerOutput.innerHTML = '';
    setRunnerJobStatus('', 'Ready');
  });
  if (runnerCode) {
    runnerCode.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); executeCode(); }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PATH B — Game Explorer Tree (Vector SVG Nodes & Recursive Hierarchy)
  // ═══════════════════════════════════════════════════════════════════════════
  const TREE_SVGS = {
    folder: `<svg class="tree-icon icon-folder" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
    script: `<svg class="tree-icon icon-script" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`,
    localscript: `<svg class="tree-icon icon-localscript" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><polyline points="8 12 11 15 8 18"></polyline></svg>`,
    modulescript: `<svg class="tree-icon icon-modulescript" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`,
    model: `<svg class="tree-icon icon-model" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>`,
    part: `<svg class="tree-icon icon-part" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>`,
    remote: `<svg class="tree-icon icon-remote" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"></path><path d="M12 5l7 7-7 7"></path></svg>`,
    service: `<svg class="tree-icon icon-service" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>`
  };

  const SERVICE_SVGS = {
    Workspace: `<svg class="tree-icon icon-workspace" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`,
    Lighting: `<svg class="tree-icon icon-lighting" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`,
    SoundService: `<svg class="tree-icon icon-sound" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`,
    Players: `<svg class="tree-icon icon-players" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
    Teams: `<svg class="tree-icon icon-teams" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>`,
    ReplicatedStorage: `<svg class="tree-icon icon-storage" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>`,
    ServerScriptService: `<svg class="tree-icon icon-server" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>`,
    ServerStorage: `<svg class="tree-icon icon-storage" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`,
    StarterGui: `<svg class="tree-icon icon-gui" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>`,
    StarterPack: `<svg class="tree-icon icon-pack" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`,
    StarterPlayer: `<svg class="tree-icon icon-player" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`
  };

  const INSTANCE_SVGS = {
    player: `<svg class="tree-icon icon-player" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
    effect: `<svg class="tree-icon icon-effect" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path></svg>`,
    sound: `<svg class="tree-icon icon-sound" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`,
    gui: `<svg class="tree-icon icon-gui" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line></svg>`,
    light: `<svg class="tree-icon icon-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"></path></svg>`,
    tool: `<svg class="tree-icon icon-tool" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>`,
    camera: `<svg class="tree-icon icon-camera" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>`,
    value: `<svg class="tree-icon icon-value" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>`,
    spawn: `<svg class="tree-icon icon-spawn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`
  };

  function getServiceIcon(serviceName) {
    return SERVICE_SVGS[serviceName] || TREE_SVGS.service;
  }

  function getInstanceIcon(className) {
    switch (className) {
      case 'Script': return TREE_SVGS.script;
      case 'LocalScript': return TREE_SVGS.localscript;
      case 'ModuleScript': return TREE_SVGS.modulescript;
      case 'Model': return TREE_SVGS.model;
      case 'Part': case 'MeshPart': case 'WedgePart': case 'TrussPart': case 'CornerWedgePart': return TREE_SVGS.part;
      case 'RemoteEvent': case 'RemoteFunction': case 'BindableEvent': case 'BindableFunction': return TREE_SVGS.remote;
      case 'Player': return INSTANCE_SVGS.player;
      case 'Sky': case 'Atmosphere': case 'SunRaysEffect': case 'BloomEffect': case 'DepthOfFieldEffect':
      case 'BlurEffect': case 'ColorCorrectionEffect': case 'PostEffect': return INSTANCE_SVGS.effect;
      case 'Sound': case 'SoundGroup': return INSTANCE_SVGS.sound;
      case 'PointLight': case 'SpotLight': case 'SurfaceLight': return INSTANCE_SVGS.light;
      case 'ScreenGui': case 'BillboardGui': case 'SurfaceGui': case 'Frame': case 'ScrollingFrame':
      case 'TextLabel': case 'TextButton': case 'TextBox': case 'ImageLabel': case 'ImageButton': return INSTANCE_SVGS.gui;
      case 'Tool': case 'Accessory': case 'Hat': return INSTANCE_SVGS.tool;
      case 'Camera': return INSTANCE_SVGS.camera;
      case 'SpawnLocation': return INSTANCE_SVGS.spawn;
      case 'StringValue': case 'IntValue': case 'NumberValue': case 'BoolValue':
      case 'ObjectValue': case 'Color3Value': case 'CFrameValue': case 'Vector3Value': return INSTANCE_SVGS.value;
      default: return TREE_SVGS.folder;
    }
  }

  function createInstanceNodeEl(child) {
    const nodeWrapper = document.createElement('div');
    nodeWrapper.className = 'explorer-node-wrapper';

    const hasChildren = child.children && child.children.length > 0;
    const cIcon = getInstanceIcon(child.className);

    const nodeEl = document.createElement('div');
    nodeEl.className = 'explorer-node';
    nodeEl.innerHTML = `
      ${hasChildren ? `
        <svg class="explorer-chevron-child" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      ` : `<span class="explorer-leaf-spacer"></span>`}
      <span class="explorer-node-icon">${cIcon}</span>
      <span class="explorer-node-name">${escapeHtml(child.name)}</span>
      <span class="explorer-node-class ${escapeHtml(child.className)}">${escapeHtml(child.className)}</span>
      ${hasChildren ? `<span class="explorer-child-pill">${child.children.length}</span>` : ''}
    `;
    nodeWrapper.appendChild(nodeEl);

    if (hasChildren) {
      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'explorer-node-children';
      for (const grandChild of child.children) {
        childrenContainer.appendChild(createInstanceNodeEl(grandChild));
      }
      nodeWrapper.appendChild(childrenContainer);

      const chevron = nodeEl.querySelector('.explorer-chevron-child');
      if (chevron) {
        chevron.addEventListener('click', (e) => {
          e.stopPropagation();
          nodeWrapper.classList.toggle('collapsed');
        });
      }
    }

    return nodeWrapper;
  }

  function renderExplorerTree(tree, timestamp) {
    if (!explorerTree) return;
    explorerTree.innerHTML = '';
    if (!tree || tree.length === 0) {
      explorerTree.innerHTML = '<div class="explorer-empty">No DataModel received from Studio.</div>';
      return;
    }
    if (explorerTimestamp && timestamp) {
      explorerTimestamp.textContent = `Updated ${new Date(timestamp).toLocaleTimeString()}`;
      explorerTimestamp.className = 'badge badge-success';
    }
    for (const svcNode of tree) {
      const childCount = svcNode.children ? svcNode.children.length : 0;
      const svcEl = document.createElement('div');
      svcEl.className = 'explorer-service';
      svcEl.innerHTML = `
        <div class="explorer-service-header">
          <svg class="explorer-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
          <span class="explorer-service-icon">${getServiceIcon(svcNode.name)}</span>
          <span class="explorer-service-name">${escapeHtml(svcNode.name)}</span>
          <span class="explorer-child-count">${childCount}</span>
        </div>
        <div class="explorer-service-children"></div>
      `;
      const header   = svcEl.querySelector('.explorer-service-header');
      const children = svcEl.querySelector('.explorer-service-children');
      if (svcNode.children && svcNode.children.length > 0) {
        for (const child of svcNode.children) {
          children.appendChild(createInstanceNodeEl(child));
        }
      } else {
        children.innerHTML = '<div class="explorer-more">Empty</div>';
      }
      header.addEventListener('click', () => svcEl.classList.toggle('collapsed'));
      explorerTree.appendChild(svcEl);
    }
  }

  async function fetchTree() {
    try {
      const res  = await fetch('/tree');
      const data = await res.json();
      if (data.tree) renderExplorerTree(data.tree, data.timestamp);
    } catch (e) { /* silent */ }
  }

  if (btnRefreshTree) {
    btnRefreshTree.addEventListener('click', () => {
      if (explorerTree) explorerTree.innerHTML = '<div class="explorer-empty">Requesting snapshot...</div>';
      showToast('Requesting DataModel snapshot from Studio...', 'info');
      fetchTree();
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PATH B — Studio LogService Console
  // ═══════════════════════════════════════════════════════════════════════════
  function appendStudioLog(entry) {
    if (!consoleLog) return;
    const level   = (entry.level || 'print').toLowerCase();
    const cssClass = `studio-${level}`;
    const el = document.createElement('div');
    el.className = `log-entry ${cssClass}`;
    const timeStr = new Date(entry.timestamp || Date.now()).toLocaleTimeString();
    el.innerHTML = `
      <span class="log-timestamp">[${timeStr}]</span>
      <span class="log-tag tag-${cssClass}">studio:${level}</span>
      <span class="log-message">${escapeHtml(entry.message || '')}</span>
    `;
    consoleLog.appendChild(el);
    if (activeConsoleFilter !== 'all') {
      const show = (activeConsoleFilter === 'print' && level === 'print') ||
                   (activeConsoleFilter === 'warn' && (level === 'warn' || level === 'warning')) ||
                   (activeConsoleFilter === 'error' && level === 'error');
      el.style.display = show ? '' : 'none';
    }
    consoleLog.scrollTop = consoleLog.scrollHeight;
    const allEntries = consoleLog.querySelectorAll('.log-entry');
    if (allEntries.length > 500) allEntries[0].remove();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FEATURE 1 — .rbxlx Place File Export
  // ═══════════════════════════════════════════════════════════════════════════
  async function exportRbxlx() {
    showToast('Generating Roblox place XML (.rbxlx)...', 'info');
    try {
      const res = await fetch('/api/export-rbxlx');
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(`Export failed: ${err.error || 'Server error'}`, 'error');
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentProject || 'RobloxPlace'}.rbxlx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('Exported .rbxlx successfully', 'success');
    } catch (err) {
      showToast(`Export failed: ${err.message}`, 'error');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FEATURE 2 — Smart Conflict Diff & Resolution
  // ═══════════════════════════════════════════════════════════════════════════
  async function checkPendingConflicts() {
    try {
      const res = await fetch('/api/conflicts');
      if (!res.ok) return;
      const data = await res.json();
      if (data.conflicts && data.conflicts.length > 0) {
        openConflictModal(data.conflicts[0]);
      }
    } catch (e) {
      console.error('Failed to check pending conflicts:', e);
    }
  }

  function openConflictModal(data) {
    if (!modalConflict) return;
    activeConflictPath = data.relPath;
    if (conflictFilePath) conflictFilePath.textContent = data.relPath || 'Unknown file';
    if (conflictIdeContent) conflictIdeContent.value = data.ideContent || '';
    if (conflictStudioContent) conflictStudioContent.value = data.studioContent || '';
    modalConflict.classList.remove('hidden');
    showToast(`Conflict on "${data.relPath}". Select IDE or Studio version to keep.`, 'warn');
  }

  async function resolveConflict(resolution) {
    if (!activeConflictPath) return;
    try {
      const res = await fetch('/api/resolve-conflict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relPath: activeConflictPath, resolution })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (modalConflict) modalConflict.classList.add('hidden');
        showToast(`Kept ${resolution.toUpperCase()} version for ${activeConflictPath}`, 'success');
        activeConflictPath = null;
        fetchFiles();
      } else {
        showToast(`Resolution failed: ${data.error || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      showToast(`Resolution failed: ${err.message}`, 'error');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FEATURE 6 — Wally Package Manager
  // ═══════════════════════════════════════════════════════════════════════════
  async function wallyInstall() {
    try {
      const statusRes = await fetch('/api/wally-status').then(r => r.json()).catch(() => ({}));
      if (!statusRes.hasWally) {
        const initWally = confirm(`No "wally.toml" found in active project "${currentProject}".\n\nWould you like Blox Sync to initialize a default wally.toml now?`);
        if (initWally) {
          const initRes = await fetch('/api/wally-init', { method: 'POST' });
          if (initRes.ok) {
            showToast('Initialized wally.toml in project', 'success');
            checkProjectFeatures();
          } else {
            showToast('Failed to create wally.toml', 'error');
          }
        }
        return;
      }
      if (btnWallyInstall) btnWallyInstall.classList.add('loading');
      showToast('Running wally install...', 'info');
      const res = await fetch('/api/wally-install', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (btnWallyInstall) btnWallyInstall.classList.remove('loading');
      if (res.ok) {
        showToast('Wally packages installed successfully', 'success');
        fetchFiles();
      } else {
        showToast(`Wally install failed: ${data.error || 'Check console output'}`, 'error');
      }
    } catch (err) {
      if (btnWallyInstall) btnWallyInstall.classList.remove('loading');
      showToast(`Wally error: ${err.message}`, 'error');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FEATURE 7 — TypeScript / roblox-ts Manual Compile
  // ═══════════════════════════════════════════════════════════════════════════
  async function tsCompile() {
    if (btnTsCompile) btnTsCompile.classList.add('ts-compiling');
    showToast('Compiling TypeScript via roblox-ts (rbxtsc)...', 'info');
    try {
      const res = await fetch('/api/ts-compile', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (btnTsCompile) btnTsCompile.classList.remove('ts-compiling');
        showToast(`TypeScript build error: ${data.error || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      if (btnTsCompile) btnTsCompile.classList.remove('ts-compiling');
      showToast(`TypeScript build error: ${err.message}`, 'error');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Feature Check (TypeScript & Wally indicators)
  // ═══════════════════════════════════════════════════════════════════════════
  async function checkProjectFeatures() {
    try {
      const [tsRes, wallyRes] = await Promise.all([
        fetch('/api/ts-status').then(r => r.json()).catch(() => null),
        fetch('/api/wally-status').then(r => r.json()).catch(() => null)
      ]);

      if (statCardTs && statTsStatus) {
        if (tsRes && tsRes.isTypeScriptProject) {
          statCardTs.classList.remove('hidden');
          statTsStatus.textContent = tsRes.tsCompiling ? 'Compiling…' : 'Active (rbxtsc)';
          if (btnTsCompile) btnTsCompile.classList.remove('hidden');
        } else {
          statCardTs.classList.add('hidden');
          if (btnTsCompile) btnTsCompile.classList.add('hidden');
        }
      }

      if (btnWallyInstall) {
        if (wallyRes && wallyRes.hasWally) {
          btnWallyInstall.classList.remove('hidden');
          btnWallyInstall.title = 'Run wally install (wally.toml detected)';
        } else {
          btnWallyInstall.title = 'Wally package install (no wally.toml detected in project)';
        }
      }
    } catch (e) { /* silent */ }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Frameless Desktop Window Controls (Electron frame: false)
  // ═══════════════════════════════════════════════════════════════════════════
  function setupDesktopControls() {
    if (window.bloxSyncDesktop && window.bloxSyncDesktop.isElectron) {
      document.body.classList.add('is-electron');

      const iconMax = btnWinMax?.querySelector('.icon-max');
      const iconRestore = btnWinMax?.querySelector('.icon-restore');

      btnWinMin?.addEventListener('click', () => {
        window.bloxSyncDesktop.minimize();
      });

      btnWinMax?.addEventListener('click', () => {
        window.bloxSyncDesktop.maximize();
      });

      btnWinClose?.addEventListener('click', () => {
        window.bloxSyncDesktop.close();
      });

      window.bloxSyncDesktop.onMaximizedChange((isMax) => {
        if (iconMax && iconRestore) {
          iconMax.style.display = isMax ? 'none' : 'block';
          iconRestore.style.display = isMax ? 'block' : 'none';
        }
      });

      // Check initial maximized state
      if (typeof window.bloxSyncDesktop.isMaximized === 'function') {
        window.bloxSyncDesktop.isMaximized().then((isMax) => {
          if (iconMax && iconRestore) {
            iconMax.style.display = isMax ? 'none' : 'block';
            iconRestore.style.display = isMax ? 'block' : 'none';
          }
        }).catch(() => {});
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Enhanced Developer UI/UX Features
  // ═══════════════════════════════════════════════════════════════════════════
  function setupEnhancedUX() {
    // 1. Luau Runner Snippet Presets
    const LUAU_SNIPPETS = {
      inspect_workspace: `-- Inspect top-level Workspace instances\nprint("=== WORKSPACE INSPECTION ===")\nlocal children = workspace:GetChildren()\nprint("Total objects in Workspace:", #children)\nfor i, obj in ipairs(children) do\n    print(string.format("[%d] %s (%s)", i, obj.Name, obj.ClassName))\nend\nreturn #children\n`,
      spawn_part: `-- Spawn an illuminated neon part\nlocal part = Instance.new("Part")\npart.Name = "BloxSyncGlowCube"\npart.Size = Vector3.new(4, 4, 4)\npart.Position = Vector3.new(0, 10, 0)\npart.Material = Enum.Material.Neon\npart.Color = Color3.fromRGB(0, 170, 255)\npart.Anchored = true\npart.Parent = workspace\nprint("Spawned glowing part at:", part.Position)\nreturn part:GetFullName()\n`,
      list_players: `-- List active players in session\nlocal Players = game:GetService("Players")\nlocal playerList = Players:GetPlayers()\nprint("Active Players Count:", #playerList)\nfor i, player in ipairs(playerList) do\n    print(string.format("[%d] %s (UserId: %d)", i, player.Name, player.UserId))\nend\nreturn #playerList\n`,
      server_uptime: `-- Print game time and memory metrics\nlocal Stats = game:GetService("Stats")\nlocal mem = Stats:GetTotalMemoryUsageMb()\nprint("Server Time:", os.date("%X"))\nprint(string.format("Total Memory Usage: %.1f MB", mem))\nprint("DataModel PlaceId:", game.PlaceId)\nreturn { mem = mem, placeId = game.PlaceId }\n`,
      services_list: `-- List primary Roblox game services\nlocal serviceNames = {\n    "Workspace", "Players", "Lighting", "ReplicatedStorage",\n    "ServerScriptService", "ServerStorage", "StarterGui",\n    "StarterPack", "SoundService", "Chat"\n}\nfor _, name in ipairs(serviceNames) do\n    local ok, s = pcall(function() return game:GetService(name) end)\n    if ok and s then\n        print(string.format("✓ Service %-20s has %d children", name, #s:GetChildren()))\n    end\nend\n`,
      benchmark: `-- Benchmark math/loop operation\nlocal start = os.clock()\nlocal sum = 0\nfor i = 1, 100000 do\n    sum = sum + math.sqrt(i)\nend\nlocal elapsed = (os.clock() - start) * 1000\nprint(string.format("Calculated 100,000 iterations in %.3f ms (sum = %.2f)", elapsed, sum))\nreturn elapsed\n`
    };

    if (runnerSnippetSelect) {
      runnerSnippetSelect.addEventListener('change', () => {
        const key = runnerSnippetSelect.value;
        if (LUAU_SNIPPETS[key] && runnerCode) {
          runnerCode.value = LUAU_SNIPPETS[key];
          runnerSnippetSelect.value = '';
          runnerCode.focus();
          showToast('Luau snippet loaded into editor', 'info');
        }
      });
    }

    // 2. Luau Runner Copy Output Button
    if (btnCopyRunnerOutput) {
      btnCopyRunnerOutput.addEventListener('click', () => {
        const text = runnerOutput?.innerText?.trim();
        if (!text) {
          showToast('Nothing to copy', 'info');
          return;
        }
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).then(() => {
            showToast('Output copied to clipboard', 'success');
          }).catch(() => {
            showToast('Failed to copy to clipboard', 'error');
          });
        }
      });
    }

    // 3. Console Copy Visible Logs Button
    if (btnCopyConsole) {
      btnCopyConsole.addEventListener('click', () => {
        if (!consoleLog) return;
        const visibleEntries = Array.from(consoleLog.querySelectorAll('.log-entry')).filter(e => e.style.display !== 'none');
        if (visibleEntries.length === 0) {
          showToast('No logs to copy', 'info');
          return;
        }
        const text = visibleEntries.map(e => e.innerText).join('\n');
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).then(() => {
            showToast('Logs copied to clipboard', 'success');
          }).catch(() => {
            showToast('Failed to copy to clipboard', 'error');
          });
        }
      });
    }

    // 4. Console Filter Chips (All / Prints / Warns / Errors)
    if (consoleFilterGroup) {
      consoleFilterGroup.addEventListener('click', (e) => {
        const chip = e.target.closest('.filter-chip');
        if (!chip) return;
        consoleFilterGroup.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        activeConsoleFilter = chip.dataset.filter || 'all';
        applyConsoleFilter();
      });
    }

    function applyConsoleFilter() {
      if (!consoleLog) return;
      const entries = consoleLog.querySelectorAll('.log-entry');
      entries.forEach(entry => {
        if (activeConsoleFilter === 'all') {
          entry.style.display = '';
        } else if (activeConsoleFilter === 'print') {
          const isPrint = entry.classList.contains('print') || entry.classList.contains('info') || entry.classList.contains('sync') || entry.classList.contains('studio-print');
          entry.style.display = isPrint ? '' : 'none';
        } else if (activeConsoleFilter === 'warn') {
          const isWarn = entry.classList.contains('warn') || entry.classList.contains('studio-warn') || entry.classList.contains('studio-warning');
          entry.style.display = isWarn ? '' : 'none';
        } else if (activeConsoleFilter === 'error') {
          const isError = entry.classList.contains('error') || entry.classList.contains('studio-error');
          entry.style.display = isError ? '' : 'none';
        }
      });
    }

    // 5. Game Explorer Search Filter
    if (explorerSearchInput) {
      explorerSearchInput.addEventListener('input', () => {
        if (!explorerTree) return;
        const query = explorerSearchInput.value.toLowerCase().trim();
        const services = explorerTree.querySelectorAll('.explorer-service');
        services.forEach(svc => {
          let anyMatch = false;
          const nodes = svc.querySelectorAll('.explorer-node');
          nodes.forEach(node => {
            const text = node.textContent.toLowerCase();
            const matches = !query || text.includes(query);
            node.style.display = matches ? '' : 'none';
            if (matches) anyMatch = true;
          });
          const svcName = svc.querySelector('.explorer-service-name')?.textContent.toLowerCase() || '';
          if (svcName.includes(query)) anyMatch = true;
          svc.style.display = !query || anyMatch ? '' : 'none';
          if (query && anyMatch) {
            svc.classList.remove('collapsed');
          }
        });
      });
    }

    // 6. Game Explorer Expand/Collapse All
    if (btnExpandAllTree) {
      btnExpandAllTree.addEventListener('click', () => {
        if (!explorerTree) return;
        explorerTree.querySelectorAll('.explorer-service').forEach(s => s.classList.remove('collapsed'));
        showToast('Expanded all services', 'info');
      });
    }

    if (btnCollapseAllTree) {
      btnCollapseAllTree.addEventListener('click', () => {
        if (!explorerTree) return;
        explorerTree.querySelectorAll('.explorer-service').forEach(s => s.classList.add('collapsed'));
        showToast('Collapsed all services', 'info');
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MCP First-Run Setup Modal
  // ═══════════════════════════════════════════════════════════════════════
  async function initMcpSetup() {
    try {
      const res  = await fetch('/api/mcp/status');
      const data = await res.json();
      if (data.installed) return; // Already set up — nothing to do

      // Show modal after a short delay so the main app renders first
      setTimeout(() => {
        const overlay = document.getElementById('modalMcpSetup');
        if (overlay) overlay.classList.remove('hidden');
      }, 600);

      // Wire up Install button
      const btnInstall = document.getElementById('btnMcpInstall');
      if (btnInstall) {
        btnInstall.addEventListener('click', async () => {
          // Switch to progress view
          const featureList    = document.getElementById('mcpFeatureList');
          const progressSection = document.getElementById('mcpProgressSection');
          if (featureList)     featureList.classList.add('hidden');
          if (progressSection) progressSection.classList.remove('hidden');

          // Disable install button while running
          btnInstall.disabled = true;
          btnInstall.textContent = 'Installing...';

          await fetch('/api/mcp/install', { method: 'POST' });
          // Progress + completion handled via WebSocket (mcp_install_progress / mcp_install_complete)
        });
      }

      // Wire up Skip button
      const btnSkip = document.getElementById('btnMcpSkip');
      if (btnSkip) {
        btnSkip.addEventListener('click', () => {
          const overlay = document.getElementById('modalMcpSetup');
          if (overlay) overlay.classList.add('hidden');
        });
      }

      // Wire up Done button
      const btnClose = document.getElementById('btnMcpClose');
      if (btnClose) {
        btnClose.addEventListener('click', () => {
          const overlay = document.getElementById('modalMcpSetup');
          if (overlay) overlay.classList.add('hidden');
        });
      }
    } catch (_) { /* server not ready yet — skip silently */ }
  }

});

