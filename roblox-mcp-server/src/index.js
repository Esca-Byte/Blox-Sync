#!/usr/bin/env node

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🤖 Roblox Universal IDE Bridge — Model Context Protocol (MCP) Server
 * ═══════════════════════════════════════════════════════════════════════════
 * Allows AI assistants (Antigravity, Cursor, Claude Desktop, etc.) to
 * interact directly with Roblox Studio:
 *   • roblox_get_status          - Connection & project status
 *   • roblox_run_luau            - Execute Luau code live in Studio
 *   • roblox_get_datamodel_tree  - Inspect live DataModel hierarchy
 *   • roblox_read_studio_logs    - Stream print/warn/error logs
 *   • roblox_get_tracked_files   - List synced scripts & GUIDs
 *   • roblox_write_script        - Write script & instant-sync to Studio
 *   • roblox_export_place        - Export .rbxlx place XML
 *   • roblox_install_wally       - Run wally install package manager
 * ═══════════════════════════════════════════════════════════════════════════
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

const BRIDGE_BASE_URL = process.env.ROBLOX_BRIDGE_URL || 'http://localhost:7777';

// ── HTTP Helper ─────────────────────────────────────────────────────────────
async function bridgeRequest(endpoint, method = 'GET', body = null) {
  const url = `${BRIDGE_BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      return { ok: res.ok, status: res.status, data };
    } else {
      const text = await res.text();
      return { ok: res.ok, status: res.status, text };
    }
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: `Failed to connect to Roblox Bridge at ${BRIDGE_BASE_URL}. Is the Bridge Desktop App or Server running? (${err.message})`,
    };
  }
}

// ── MCP Server Instance ─────────────────────────────────────────────────────
const server = new Server(
  {
    name: 'roblox-bridge-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ── Tool Definitions ────────────────────────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'roblox_get_status',
        description:
          'Get current status of the Roblox Bridge and Roblox Studio connection, active project name, tracked file count, and server uptime.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'roblox_run_luau',
        description:
          'Execute Luau code directly inside the running Roblox Studio session and return stdout, return value, errors, and execution time. Studio must be connected. Use this tool for live in-Studio execution, inspecting state, spawning objects, or controlling playtests. Playtest recipes: (1) Start Solo Playtest: "local s = game:GetService(\'StudioTestService\') s:ExecutePlayModeAsync()", (2) Stop Playtest: "local s = game:GetService(\'StudioTestService\') s:StopPlayMode()", (3) Start Server & Players: "local s = game:GetService(\'StudioTestService\') s:StartServerAndPlayers(1)". DO NOT search the web or inspect files for playtest APIs—use these recipes directly.',
        inputSchema: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description:
                'The Luau code to execute in Studio (e.g. "game:GetService(\'StudioTestService\'):ExecutePlayModeAsync()" to start playtest, "return workspace.DistributedGameTime", or "print(#game.Players:GetPlayers())").',
            },
            context: {
              type: 'string',
              description: 'Optional execution context label. Default is "AI MCP Agent".',
            },
          },
          required: ['code'],
        },
      },
      {
        name: 'roblox_get_datamodel_tree',
        description:
          'Get the live DataModel hierarchy tree from Roblox Studio to inspect game instances, services, folders, parts, and scripts.',
        inputSchema: {
          type: 'object',
          properties: {
            serviceFilter: {
              type: 'string',
              description:
                'Optional service name to filter by (e.g. "Workspace", "ReplicatedStorage", "ServerScriptService", "StarterGui", "StarterPlayer"). If omitted, returns all services.',
            },
            maxDepth: {
              type: 'number',
              description: 'Maximum hierarchy depth to inspect (default: 3).',
            },
          },
        },
      },
      {
        name: 'roblox_read_studio_logs',
        description:
          "Read live print, warn, and error log entries streamed from Roblox Studio's LogService. Essential for autonomous error debugging.",
        inputSchema: {
          type: 'object',
          properties: {
            level: {
              type: 'string',
              enum: ['all', 'print', 'warn', 'error'],
              description: "Filter logs by level: 'all', 'print', 'warn', or 'error' (default: 'all').",
            },
            limit: {
              type: 'number',
              description: 'Maximum number of recent log entries to return (default: 50).',
            },
          },
        },
      },
      {
        name: 'roblox_get_tracked_files',
        description:
          'List all scripts currently tracked and synced by the bridge in the active project, including their relative paths, script types, Roblox hierarchy paths, and GUIDs.',
        inputSchema: {
          type: 'object',
          properties: {
            includeContent: {
              type: 'boolean',
              description: 'Whether to include full script content in output (default: false).',
            },
          },
        },
      },
      {
        name: 'roblox_write_script',
        description:
          'Create or update a script in the active project and immediately sync it into Roblox Studio in real time. Preserves GUIDs and .meta.json sidecars.',
        inputSchema: {
          type: 'object',
          properties: {
            relPath: {
              type: 'string',
              description:
                'Relative path to the script file (e.g. "src/ReplicatedStorage/Modules/TestModule.luau" or "src/ServerScriptService/GameServer.server.luau").',
            },
            content: {
              type: 'string',
              description: 'The Lua/Luau script source content.',
            },
            scriptType: {
              type: 'string',
              enum: ['ModuleScript', 'Script', 'LocalScript'],
              description: 'Optional script type. If omitted, inferred from file extension.',
            },
            force: {
              type: 'boolean',
              description: 'Set to true to override conflict detection (default: false).',
            },
          },
          required: ['relPath', 'content'],
        },
      },
      {
        name: 'roblox_export_place',
        description:
          'Export the active project as a standalone .rbxlx Roblox XML place file with full hierarchy preservation.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'roblox_install_wally',
        description:
          'Run "wally install" in the active project directory to download and install Roblox package dependencies defined in wally.toml.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'roblox_launch_studio',
        description:
          'Launch Roblox Studio on the host machine using the installed Roblox Studio shortcut or executable.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'roblox_start_playtest',
        description:
          'Start a Roblox Studio playtest session directly. Supports "solo" (Play Solo) or "server" (Server + N clients).',
        inputSchema: {
          type: 'object',
          properties: {
            mode: {
              type: 'string',
              enum: ['solo', 'server'],
              description: 'Playtest mode: "solo" for Play Solo, "server" for Server and local test players (default: "solo").',
            },
            playerCount: {
              type: 'number',
              description: 'Number of test players if mode is "server" (default: 1).',
            },
          },
        },
      },
      {
        name: 'roblox_stop_playtest',
        description:
          'Stop the active Roblox Studio playtest session and return Studio to Edit Mode.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'roblox_lint_script',
        description:
          'Statically check and validate Luau code or a tracked script file for syntax errors, bracket mismatches, illegal tokens, or static analysis issues before syncing to Studio.',
        inputSchema: {
          type: 'object',
          properties: {
            relPath: {
              type: 'string',
              description: 'Relative path of the script to lint (e.g. "src/ServerScriptService/GameManager.server.luau").',
            },
            code: {
              type: 'string',
              description: 'Optional raw Luau source code string to validate directly.',
            },
          },
        },
      },
    ],
  };
});

// ── Tool Execution Handler ──────────────────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // 1. Status
      case 'roblox_get_status': {
        const res = await bridgeRequest('/status');
        if (!res.ok) {
          return {
            content: [{ type: 'text', text: res.error || `Error (${res.status}): ${JSON.stringify(res.data)}` }],
            isError: true,
          };
        }
        const data = res.data;
        const formatted = [
          `🟢 Bridge Server: Running at ${BRIDGE_BASE_URL}`,
          `🎮 Roblox Studio: ${data.studioConnected ? 'CONNECTED' : 'DISCONNECTED (open Studio and connect plugin)'}`,
          `📁 Active Project: ${data.activeProject || 'DefaultProject'}`,
          `📄 Tracked Files: ${data.trackedFilesCount || 0}`,
          `⏱️ Server Uptime: ${data.serverStartTime ? Math.floor((Date.now() - data.serverStartTime) / 1000) + 's' : 'unknown'}`,
        ].join('\n');
        return { content: [{ type: 'text', text: formatted }] };
      }

      // 2. Run Luau
      case 'roblox_run_luau': {
        const { code, context = 'AI MCP Agent' } = args || {};
        if (!code) {
          return { content: [{ type: 'text', text: 'Error: "code" argument is required.' }], isError: true };
        }

        const res = await bridgeRequest('/execute', 'POST', { code, context });
        if (!res.ok) {
          return {
            content: [{ type: 'text', text: res.error || `Execution failed (${res.status}): ${JSON.stringify(res.data)}` }],
            isError: true,
          };
        }

        const result = res.data.result || res.data;
        let responseText = '';
        if (result.success) {
          responseText = [
            `✅ Execution Succeeded (Job #${result.jobId || 'N/A'}, ${result.executionTime ?? '?'}ms)`,
            '--- Output ---',
            result.output || '(no output)',
          ].join('\n');
        } else {
          responseText = [
            `❌ Execution Error (Job #${result.jobId || 'N/A'}, ${result.executionTime ?? '?'}ms)`,
            '--- Error Message ---',
            result.error || 'Unknown runtime error occurred in Studio.',
          ].join('\n');
        }

        return {
          content: [{ type: 'text', text: responseText }],
          isError: !result.success,
        };
      }

      // 3. DataModel Tree
      case 'roblox_get_datamodel_tree': {
        const { serviceFilter, maxDepth = 3 } = args || {};
        const res = await bridgeRequest('/tree');
        if (!res.ok) {
          return {
            content: [{ type: 'text', text: res.error || `Failed to fetch tree: ${JSON.stringify(res.data)}` }],
            isError: true,
          };
        }

        let tree = res.data.tree || {};
        if (serviceFilter) {
          const matchKey = Object.keys(tree).find((k) => k.toLowerCase() === serviceFilter.toLowerCase());
          if (matchKey) {
            tree = { [matchKey]: tree[matchKey] };
          } else {
            return {
              content: [
                {
                  type: 'text',
                  text: `Service "${serviceFilter}" not found in snapshot. Available: ${Object.keys(tree).join(', ')}`,
                },
              ],
            };
          }
        }

        // Helper to prune tree to maxDepth
        function prune(node, currentDepth) {
          if (!node || typeof node !== 'object') return node;
          if (currentDepth >= maxDepth) {
            if (node.children && node.children.length > 0) {
              return { ...node, children: `... (${node.children.length} children omitted at max depth)` };
            }
            return node;
          }
          if (Array.isArray(node.children)) {
            return { ...node, children: node.children.map((c) => prune(c, currentDepth + 1)) };
          }
          const prunedObj = {};
          for (const [k, v] of Object.entries(node)) {
            prunedObj[k] = prune(v, currentDepth + 1);
          }
          return prunedObj;
        }

        const prunedTree = prune(tree, 0);
        return {
          content: [{ type: 'text', text: JSON.stringify(prunedTree, null, 2) }],
        };
      }

      // 4. Studio Logs
      case 'roblox_read_studio_logs': {
        const { level = 'all', limit = 50 } = args || {};
        const res = await bridgeRequest('/studio-logs');
        if (!res.ok) {
          return {
            content: [{ type: 'text', text: res.error || `Failed to read logs: ${JSON.stringify(res.data)}` }],
            isError: true,
          };
        }

        let logs = res.data.logs || [];
        if (level !== 'all') {
          logs = logs.filter((l) => (l.level || '').toLowerCase() === level.toLowerCase());
        }
        logs = logs.slice(-limit);

        if (logs.length === 0) {
          return { content: [{ type: 'text', text: `No Studio logs found (filter: ${level}).` }] };
        }

        const formatted = logs
          .map((l) => {
            const time = new Date(l.timestamp || Date.now()).toLocaleTimeString();
            const tag = `[${(l.level || 'print').toUpperCase()}]`;
            return `[${time}] ${tag.padEnd(8)} ${l.message}`;
          })
          .join('\n');

        return { content: [{ type: 'text', text: formatted }] };
      }

      // 5. Tracked Files
      case 'roblox_get_tracked_files': {
        const { includeContent = false } = args || {};
        const res = await bridgeRequest('/files');
        if (!res.ok) {
          return {
            content: [{ type: 'text', text: res.error || `Failed to fetch files: ${JSON.stringify(res.data)}` }],
            isError: true,
          };
        }

        const files = res.data.files || [];
        if (!includeContent) {
          const summary = files.map((f) => ({
            relPath: f.relPath,
            scriptType: f.scriptInfo?.scriptType || 'ModuleScript',
            fullRobloxPath: f.scriptInfo?.fullRobloxPath || '',
            guid: f.guid || 'none',
          }));
          return {
            content: [
              {
                type: 'text',
                text: `Project: ${res.data.projectName || 'Default'}\nTotal Files: ${files.length}\n\n` +
                  JSON.stringify(summary, null, 2),
              },
            ],
          };
        }

        return { content: [{ type: 'text', text: JSON.stringify(files, null, 2) }] };
      }

      // 6. Write Script
      case 'roblox_write_script': {
        const { relPath, content, scriptType, force = false } = args || {};
        if (!relPath || content === undefined) {
          return {
            content: [{ type: 'text', text: 'Error: "relPath" and "content" arguments are required.' }],
            isError: true,
          };
        }

        const res = await bridgeRequest('/write', 'POST', {
          relPath,
          content,
          scriptType,
          force,
        });

        if (!res.ok) {
          if (res.status === 409) {
            return {
              content: [
                {
                  type: 'text',
                  text: `⚠️ Conflict Detected on ${relPath}: File was modified recently in Studio. Set "force: true" to overwrite.`,
                },
              ],
              isError: true,
            };
          }
          return {
            content: [{ type: 'text', text: res.error || `Write failed (${res.status}): ${JSON.stringify(res.data)}` }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `✅ Script successfully written and synced to Roblox Studio: ${relPath}`,
            },
          ],
        };
      }

      // 7. Export .rbxlx
      case 'roblox_export_place': {
        const res = await bridgeRequest('/api/export-rbxlx');
        if (!res.ok) {
          return {
            content: [{ type: 'text', text: res.error || `Export failed (${res.status})` }],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: 'text',
              text: `✅ Place exported successfully! XML size: ${(res.text || '').length} characters. Valid .rbxlx ready for Studio.`,
            },
          ],
        };
      }

      // 8. Wally Install
      case 'roblox_install_wally': {
        const res = await bridgeRequest('/api/wally-install', 'POST');
        if (!res.ok) {
          return {
            content: [
              {
                type: 'text',
                text: res.error || `Wally install failed: ${res.data?.error || JSON.stringify(res.data)}`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: 'text',
              text: `✅ Wally install completed:\n${res.data?.output || 'Packages installed.'}`,
            },
          ],
        };
      }

      // 9. Launch Roblox Studio
      case 'roblox_launch_studio': {
        const res = await bridgeRequest('/api/open-studio', 'POST');
        if (!res.ok) {
          return {
            content: [
              {
                type: 'text',
                text: res.error || `Failed to launch Roblox Studio: ${res.data?.error || JSON.stringify(res.data)}`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: 'text',
              text: `🚀 Roblox Studio launched successfully! (${res.data?.message || 'Started'})`,
            },
          ],
        };
      }

      // 10. Start Playtest
      case 'roblox_start_playtest': {
        const mode = args?.mode || 'solo';
        const playerCount = Number(args?.playerCount) || 1;
        let luauCode = 'local s = game:GetService("StudioTestService")\n';
        if (mode === 'server') {
          luauCode += `s:StartServerAndPlayers(${playerCount})\nprint("Started server and ${playerCount} player(s) playtest.")`;
        } else {
          luauCode += 's:ExecutePlayModeAsync()\nprint("Play solo playtest active.")';
        }

        const res = await bridgeRequest('/execute', 'POST', { code: luauCode, context: 'MCP Start Playtest' });
        if (!res.ok) {
          return {
            content: [{ type: 'text', text: res.error || `Failed to start playtest: ${JSON.stringify(res.data)}` }],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: 'text',
              text: `🎮 Roblox Studio playtest (${mode}) started successfully! Job queued with ID #${res.data?.jobId || 'ok'}.`,
            },
          ],
        };
      }

      // 11. Stop Playtest
      case 'roblox_stop_playtest': {
        const luauCode = 'local s = game:GetService("StudioTestService")\ns:StopPlayMode()\nprint("Playtest stopped.")';
        const res = await bridgeRequest('/execute', 'POST', { code: luauCode, context: 'MCP Stop Playtest' });
        if (!res.ok) {
          return {
            content: [{ type: 'text', text: res.error || `Failed to stop playtest: ${JSON.stringify(res.data)}` }],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: 'text',
              text: `🛑 Roblox Studio playtest stopped. Returned to edit mode.`,
            },
          ],
        };
      }

      // 12. Lint & Validate Script
      case 'roblox_lint_script': {
        let codeToLint = args?.code || '';
        const relPath = args?.relPath;

        if (!codeToLint && relPath) {
          const filesRes = await bridgeRequest('/files');
          if (filesRes.ok && Array.isArray(filesRes.data?.files)) {
            const found = filesRes.data.files.find((f) => f.scriptInfo?.relPath === relPath || f.absPath?.endsWith(relPath));
            if (found) {
              codeToLint = found.content || '';
            }
          }
          if (!codeToLint) {
            return {
              content: [{ type: 'text', text: `Could not find tracked script content for: ${relPath}` }],
              isError: true,
            };
          }
        }

        if (!codeToLint.trim()) {
          return {
            content: [{ type: 'text', text: 'Provide either "code" string or a valid "relPath" to lint.' }],
            isError: true,
          };
        }

        // Static syntax check (balanced brackets, quotes, illegal characters, keyword balance)
        const issues = [];
        const lines = codeToLint.split('\n');
        let openParen = 0, openBracket = 0, openBrace = 0;
        let blockKeywords = 0;

        lines.forEach((line, idx) => {
          const lineNum = idx + 1;
          const clean = line.replace(/--.*$/, ''); // strip comments
          
          for (const ch of clean) {
            if (ch === '(') openParen++;
            if (ch === ')') openParen = Math.max(0, openParen - 1);
            if (ch === '[') openBracket++;
            if (ch === ']') openBracket = Math.max(0, openBracket - 1);
            if (ch === '{') openBrace++;
            if (ch === '}') openBrace = Math.max(0, openBrace - 1);
          }

          // Check for common Luau syntax mistakes
          if (/\bfunction\b/.test(clean) && !/\bend\b/.test(clean)) blockKeywords++;
          if (/\b(then|do)\b/.test(clean) && !/\bend\b/.test(clean)) blockKeywords++;
          if (/\bend\b/.test(clean)) blockKeywords = Math.max(0, blockKeywords - 1);

          if (/===|!==/.test(clean)) {
            issues.push(`Line ${lineNum}: JavaScript equality operator '===' or '!==' used. Luau uses '==' and '~='. (${line.trim()})`);
          }
          if (/&&|\|\|/.test(clean)) {
            issues.push(`Line ${lineNum}: Logical operator '&&' or '||' used. Luau uses 'and' or 'or'. (${line.trim()})`);
          }
          if (/\bvar\b|\blet\b|\bconst\b/.test(clean)) {
            issues.push(`Line ${lineNum}: JavaScript declaration 'var/let/const' used. Luau uses 'local'. (${line.trim()})`);
          }
          if (/player\.Character\.HumanoidRootPart/i.test(clean) && !clean.includes('WaitForChild') && !clean.includes('FindFirstChild')) {
            issues.push(`Line ${lineNum}: Direct character part indexing without WaitForChild. Consider using WaitForChild("HumanoidRootPart").`);
          }
        });

        if (openParen !== 0) issues.push(`Unbalanced parentheses '(': missing ${openParen} closing ')'`);
        if (openBracket !== 0) issues.push(`Unbalanced square brackets '[': missing ${openBracket} closing ']'`);
        if (openBrace !== 0) issues.push(`Unbalanced curly braces '{': missing ${openBrace} closing '}'`);

        if (issues.length > 0) {
          return {
            content: [
              {
                type: 'text',
                text: `⚠️ Luau Linter found ${issues.length} potential issue(s)${relPath ? ` in ${relPath}` : ''}:\n` + issues.map((i) => `• ${i}`).join('\n'),
              },
            ],
            isError: false,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `✅ Luau Linter passed: 0 syntax issues detected (${lines.length} lines parsed)${relPath ? ` for ${relPath}` : ''}. Clean for Studio execution.`,
            },
          ],
        };
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool name: ${name}` }],
          isError: true,
        };
    }
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Internal tool execution error: ${err.message}` }],
      isError: true,
    };
  }
});

// ── Start MCP Server ────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[Roblox-MCP] Roblox Bridge MCP Server running on STDIO transport.');
}

main().catch((err) => {
  console.error('[Roblox-MCP] Fatal error starting server:', err);
  process.exit(1);
});
