document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const projectSelect = document.getElementById('projectSelect');
  const btnNewProject = document.getElementById('btnNewProject');
  const btnOpenIDE = document.getElementById('btnOpenIDE');
  const btnOpenFolder = document.getElementById('btnOpenFolder');
  const btnRescan = document.getElementById('btnRescan');

  const statActiveProject = document.getElementById('statActiveProject');
  const statProjectPath = document.getElementById('statProjectPath');
  const statStudioStatus = document.getElementById('statStudioStatus');
  const studioPulse = document.getElementById('studioPulse');
  const statHeartbeat = document.getElementById('statHeartbeat');
  const statTrackedCount = document.getElementById('statTrackedCount');

  const treeContainer = document.getElementById('treeContainer');
  const scriptCountBadge = document.getElementById('scriptCountBadge');

  const consoleLog = document.getElementById('consoleLog');
  const btnClearConsole = document.getElementById('btnClearConsole');

  const modalCreateProject = document.getElementById('modalCreateProject');
  const inputProjectName = document.getElementById('inputProjectName');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const btnCancelModal = document.getElementById('btnCancelModal');
  const btnSubmitCreateProject = document.getElementById('btnSubmitCreateProject');

  // State
  let ws = null;
  let trackedFiles = [];
  let projectsList = [];
  let currentProject = '';

  // Initialize
  initWebSocket();
  fetchInitialData();
  setupEventListeners();

  // WebSocket Connection
  function initWebSocket() {
    const wsUrl = `ws://${window.location.host}`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      appendConsoleLog('Connected to Roblox Bridge WebSocket Server', 'info');
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
      appendConsoleLog('WebSocket disconnected. Retrying in 3s...', 'error');
      setTimeout(initWebSocket, 3000);
    };
  }

  function handleServerEvent(data) {
    switch (data.event) {
      case 'connected':
        currentProject = data.activeProject;
        updateStatusCards(data);
        if (data.logs) {
          data.logs.forEach(l => appendConsoleLog(l.message, l.type, l.timestamp));
        }
        fetchFiles();
        fetchProjects();
        break;

      case 'log_entry':
        if (data.entry) {
          appendConsoleLog(data.entry.message, data.entry.type, data.entry.timestamp);
        }
        break;

      case 'studio_status':
        updateStudioStatus(data.connected, data.activeProject);
        break;

      case 'file_changed':
        fetchFiles();
        break;

      case 'file_deleted':
        fetchFiles();
        break;

      case 'project_switched':
        currentProject = data.projectName;
        fetchFiles();
        fetchProjects();
        break;

      case 'project_rescanned':
        fetchFiles();
        break;
    }
  }

  // REST API Requests
  async function fetchInitialData() {
    try {
      const res = await fetch('/status');
      const data = await res.json();
      currentProject = data.activeProject;
      updateStatusCards(data);
      fetchProjects();
      fetchFiles();
    } catch (e) {
      console.error('Fetch status failed:', e);
    }
  }

  async function fetchProjects() {
    try {
      const res = await fetch('/projects');
      const data = await res.json();
      projectsList = data.projects || [];
      renderProjectsSelect(data.projects, data.activeProject);
    } catch (e) {
      console.error('Fetch projects failed:', e);
    }
  }

  async function fetchFiles() {
    try {
      const res = await fetch('/files');
      const data = await res.json();
      trackedFiles = data.files || [];
      renderFileTree(trackedFiles);
      statTrackedCount.textContent = trackedFiles.length;
      scriptCountBadge.textContent = `${trackedFiles.length} files`;
    } catch (e) {
      console.error('Fetch files failed:', e);
    }
  }

  // Renderers
  function renderProjectsSelect(projects, active) {
    projectSelect.innerHTML = '';
    projects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      if (p === active) opt.selected = true;
      projectSelect.appendChild(opt);
    });
  }

  const collapsedServiceGroups = new Set();

  function showToast(message) {
    let toast = document.getElementById('toastNotice');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toastNotice';
      toast.className = 'toast-notice';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }

  function renderFileTree(files) {
    if (!files || files.length === 0) {
      treeContainer.innerHTML = `<div class="empty-state">
        <svg class="icon-svg lg text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="9" y1="15" x2="15" y2="15"></line></svg>
        <p>No scripts found in active project.</p>
      </div>`;
      return;
    }

    // Group files by top-level Roblox service / path
    const groups = {};
    files.forEach(file => {
      const fullPath = file.scriptInfo ? file.scriptInfo.fullRobloxPath : file.relPath;
      const parts = fullPath.split('.');
      const groupName = parts.length > 1 ? parts[0] : 'Workspace';

      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(file);
    });

    treeContainer.innerHTML = '';

    for (const [groupName, groupFiles] of Object.entries(groups)) {
      const isCollapsed = collapsedServiceGroups.has(groupName);

      const groupEl = document.createElement('div');
      groupEl.className = `tree-service-group ${isCollapsed ? 'is-collapsed' : ''}`;

      const titleEl = document.createElement('div');
      titleEl.className = 'tree-service-title';

      const folderSvg = `<svg class="icon-svg sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
      const arrowSvg = `<svg class="icon-svg xs chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

      titleEl.innerHTML = `
        <div class="service-title-left">
          ${arrowSvg}
          ${folderSvg}
          <span class="service-name">${groupName}</span>
        </div>
        <span class="service-count-badge">${groupFiles.length} script${groupFiles.length > 1 ? 's' : ''}</span>
      `;

      titleEl.addEventListener('click', () => {
        if (collapsedServiceGroups.has(groupName)) {
          collapsedServiceGroups.delete(groupName);
        } else {
          collapsedServiceGroups.add(groupName);
        }
        renderFileTree(trackedFiles);
      });

      groupEl.appendChild(titleEl);

      const itemsContainer = document.createElement('div');
      itemsContainer.className = 'tree-items-container';

      groupFiles.forEach(file => {
        const itemEl = document.createElement('div');
        itemEl.className = 'tree-item';

        const scriptType = file.scriptInfo ? file.scriptInfo.scriptType : 'ModuleScript';
        const scriptName = file.scriptInfo ? file.scriptInfo.scriptName : file.relPath;
        const fullRobloxPath = file.scriptInfo ? file.scriptInfo.fullRobloxPath : file.relPath;
        const typeClass = `type-${scriptType.toLowerCase()}`;

        let iconSvg = '';
        if (scriptType === 'Script') {
          iconSvg = `<svg class="icon-svg sm" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="15" x2="23" y2="15"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="15" x2="4" y2="15"></line></svg>`;
        } else if (scriptType === 'LocalScript') {
          iconSvg = `<svg class="icon-svg sm" viewBox="0 0 24 24" fill="none" stroke="#f472b6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>`;
        } else {
          iconSvg = `<svg class="icon-svg sm" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`;
        }

        itemEl.innerHTML = `
          <div class="tree-item-info">
            <span class="script-icon">${iconSvg}</span>
            <div class="script-details">
              <span class="script-name">${scriptName}</span>
              <span class="script-path-sub">${fullRobloxPath}</span>
            </div>
          </div>
          <div class="tree-item-right">
            <span class="script-type-badge ${typeClass}">${scriptType}</span>
            <div class="item-actions">
              <button class="action-icon-btn btn-open-ide" title="Open file in IDE">
                <svg class="icon-svg sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
              </button>
              <button class="action-icon-btn btn-copy-path" title="Copy Roblox instance path">
                <svg class="icon-svg sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              </button>
            </div>
          </div>
        `;

        const openInIDE = (e) => {
          if (e) e.stopPropagation();
          const savedIDE = localStorage.getItem('roblox_bridge_ide') || 'vscode';
          const savedCustomCmd = localStorage.getItem('roblox_bridge_custom_ide') || '';
          fetch('/api/open-ide', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ide: savedIDE, customCmd: savedCustomCmd })
          });
          showToast(`Opening '${scriptName}' in IDE...`);
        };

        itemEl.querySelector('.btn-open-ide').addEventListener('click', openInIDE);

        itemEl.querySelector('.btn-copy-path').addEventListener('click', (e) => {
          e.stopPropagation();
          const pathText = `game.${fullRobloxPath}`;
          navigator.clipboard.writeText(pathText);
          showToast(`Copied '${pathText}' to clipboard!`);
        });

        itemEl.addEventListener('click', openInIDE);
        itemsContainer.appendChild(itemEl);
      });

      groupEl.appendChild(itemsContainer);
      treeContainer.appendChild(groupEl);
    }
  }

  function updateStatusCards(data) {
    if (data.activeProject) {
      statActiveProject.textContent = data.activeProject;
      statProjectPath.textContent = data.activeProjectPath || 'Local Directory';
    }
    if (data.trackedFilesCount !== undefined) {
      statTrackedCount.textContent = data.trackedFilesCount;
      scriptCountBadge.textContent = `${data.trackedFilesCount} files`;
    }
    updateStudioStatus(data.studioConnected, data.activeProject, data.lastHeartbeat);
  }

  function updateStudioStatus(connected, activeProject, lastHeartbeat) {
    if (connected) {
      statStudioStatus.textContent = 'Connected';
      statStudioStatus.className = 'stat-value status-online';
      studioPulse.className = 'pulse-dot online';
      statHeartbeat.textContent = `Synced with ${activeProject || 'Studio'}`;
    } else {
      statStudioStatus.textContent = 'Disconnected';
      statStudioStatus.className = 'stat-value status-offline';
      studioPulse.className = 'pulse-dot offline';
      statHeartbeat.textContent = 'Waiting for Studio plugin connect';
    }
  }

  function appendConsoleLog(msg, type = 'info', timestamp = Date.now()) {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;

    const timeStr = new Date(timestamp).toLocaleTimeString();
    entry.innerHTML = `
      <span class="log-timestamp">[${timeStr}]</span>
      <span class="log-tag tag-${type}">${type}</span>
      <span class="log-message">${escapeHtml(msg)}</span>
    `;

    consoleLog.appendChild(entry);
    consoleLog.scrollTop = consoleLog.scrollHeight;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Event Listeners
  function setupEventListeners() {
    projectSelect.addEventListener('change', async (e) => {
      const selected = e.target.value;
      if (selected) {
        await fetch('/select-project', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: selected })
        });
      }
    });

    btnNewProject.addEventListener('click', () => {
      modalCreateProject.classList.remove('hidden');
      inputProjectName.focus();
    });

    btnCloseModal.addEventListener('click', () => modalCreateProject.classList.add('hidden'));
    btnCancelModal.addEventListener('click', () => modalCreateProject.classList.add('hidden'));

    btnSubmitCreateProject.addEventListener('click', async () => {
      const name = inputProjectName.value.trim();
      if (!name) return;
      modalCreateProject.classList.add('hidden');
      inputProjectName.value = '';

      await fetch('/create-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
    });

    btnOpenFolder.addEventListener('click', () => {
      fetch('/api/open-folder', { method: 'POST' });
    });

    // IDE Preference Management
    const getSavedIDE = () => localStorage.getItem('roblox_bridge_ide') || 'vscode';
    const getSavedCustomCmd = () => localStorage.getItem('roblox_bridge_custom_ide') || '';

    const updateIDELabel = () => {
      const saved = getSavedIDE();
      const txtOpenIDE = document.getElementById('txtOpenIDE');
      if (!txtOpenIDE) return;
      
      const names = {
        vscode: 'Open VS Code',
        cursor: 'Open Cursor',
        antigravity: 'Open Antigravity',
        qoder: 'Open Qoder',
        custom: 'Open Custom IDE'
      };
      txtOpenIDE.textContent = names[saved] || 'Open IDE';
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
      const savedIDE = getSavedIDE();
      const savedCustom = getSavedCustomCmd();
      launchIDE(savedIDE, savedCustom);
    });

    const btnSelectIDE = document.getElementById('btnSelectIDE');
    const modalSelectIDE = document.getElementById('modalSelectIDE');
    const btnCloseIDEModal = document.getElementById('btnCloseIDEModal');
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
          alert('Please enter a custom CLI command or file path.');
        }
      });
    }

    btnRescan.addEventListener('click', async () => {
      await fetch('/api/rescan', { method: 'POST' });
    });

    btnClearConsole.addEventListener('click', () => {
      consoleLog.innerHTML = '';
    });

    const btnRefreshFiles = document.getElementById('btnRefreshFiles');
    if (btnRefreshFiles) {
      btnRefreshFiles.addEventListener('click', async () => {
        await fetchFiles();
        showToast('Refreshed script list');
      });
    }

    modalCreateProject.addEventListener('click', (e) => {
      if (e.target === modalCreateProject) {
        modalCreateProject.classList.add('hidden');
      }
    });

    // Keyboard navigation (Escape key)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        modalCreateProject.classList.add('hidden');
        modalSelectIDE.classList.add('hidden');
      }
    });
  }
});
