const path = require('path');
const fs = require('fs-extra');

/**
 * Utility to parse Rojo project files (`default.project.json`) and map local files to Roblox Instances.
 */
class RojoParser {
  constructor(projectDir) {
    this.projectDir = projectDir;
  }

  /**
   * Find project file (default.project.json or *.project.json)
   */
  async findProjectFile() {
    const defaultPath = path.join(this.projectDir, 'default.project.json');
    if (await fs.pathExists(defaultPath)) {
      return defaultPath;
    }

    try {
      const files = await fs.readdir(this.projectDir);
      const projFile = files.find(f => f.endsWith('.project.json'));
      if (projFile) {
        return path.join(this.projectDir, projFile);
      }
    } catch (e) {
      // Ignore directory read error
    }

    return null;
  }

  /**
   * Parse project configuration
   */
  async parseProjectConfig() {
    const projectFile = await this.findProjectFile();
    if (!projectFile) {
      return this.generateDefaultConfig();
    }

    try {
      const content = await fs.readJson(projectFile);
      return {
        name: content.name || path.basename(this.projectDir),
        file: projectFile,
        tree: content.tree || {},
        mappings: this.extractMappingsFromTree(content.tree || {})
      };
    } catch (err) {
      console.warn(`[RojoParser] Failed to parse ${projectFile}, using default mapping:`, err.message);
      return this.generateDefaultConfig();
    }
  }

  /**
   * Generate default mapping when no default.project.json exists
   */
  generateDefaultConfig() {
    const srcDir = path.join(this.projectDir, 'src');
    return {
      name: path.basename(this.projectDir),
      file: null,
      tree: {},
      mappings: [
        { diskPath: 'src', robloxPath: '', isServiceRoot: true }
      ]
    };
  }

  /**
   * Extract disk-to-roblox mappings from Rojo tree object recursively
   */
  extractMappingsFromTree(treeNode, currentRobloxPath = '') {
    let mappings = [];

    for (const [key, val] of Object.entries(treeNode)) {
      if (key.startsWith('$')) continue;

      const robloxPath = currentRobloxPath ? `${currentRobloxPath}.${key}` : key;

      if (typeof val === 'object' && val !== null) {
        if (val['$path']) {
          mappings.push({
            diskPath: val['$path'],
            robloxPath: robloxPath,
            className: val['$className'] || null
          });
        }
        // Recursively check children
        mappings = mappings.concat(this.extractMappingsFromTree(val, robloxPath));
      }
    }

    return mappings;
  }

  /**
   * Determine script info from a relative file path inside the project
   */
  getScriptInfo(relFilePath, mappings = []) {
    const normPath = relFilePath.replace(/\\/g, '/');
    const filename = path.basename(normPath);

    // Identify script type and instance name
    let scriptType = 'ModuleScript';
    let scriptName = '';
    let isInit = false;

    if (filename.endsWith('.server.lua') || filename.endsWith('.server.luau')) {
      scriptType = 'Script';
      const ext = filename.endsWith('.server.lua') ? '.server.lua' : '.server.luau';
      scriptName = filename.slice(0, -ext.length);
      if (scriptName === 'init') {
        isInit = true;
        const parentFolder = path.basename(path.dirname(normPath));
        scriptName = parentFolder;
      }
    } else if (filename.endsWith('.client.lua') || filename.endsWith('.client.luau')) {
      scriptType = 'LocalScript';
      const ext = filename.endsWith('.client.lua') ? '.client.lua' : '.client.luau';
      scriptName = filename.slice(0, -ext.length);
      if (scriptName === 'init') {
        isInit = true;
        const parentFolder = path.basename(path.dirname(normPath));
        scriptName = parentFolder;
      }
    } else if (filename.endsWith('.lua') || filename.endsWith('.luau')) {
      scriptType = 'ModuleScript';
      const ext = filename.endsWith('.lua') ? '.lua' : '.luau';
      scriptName = filename.slice(0, -ext.length);
      if (scriptName === 'init') {
        isInit = true;
        const parentFolder = path.basename(path.dirname(normPath));
        scriptName = parentFolder;
      }
    } else {
      return null; // Not a script file
    }

    // Resolve Roblox parent hierarchy path
    let robloxHierarchy = '';

    // Check against Rojo mappings if any match diskPath prefix
    let matchedMapping = null;
    for (const mapping of mappings) {
      const normDiskPath = mapping.diskPath.replace(/\\/g, '/');
      if (normPath.startsWith(normDiskPath)) {
        if (!matchedMapping || normDiskPath.length > matchedMapping.diskPath.length) {
          matchedMapping = mapping;
        }
      }
    }

    if (matchedMapping) {
      const normDiskPath = matchedMapping.diskPath.replace(/\\/g, '/');
      let subPath = normPath.slice(normDiskPath.length);
      if (subPath.startsWith('/')) subPath = subPath.slice(1);

      const pathParts = subPath.split('/');
      pathParts.pop(); // remove filename

      // If it's an init file, the script IS the container instance
      if (isInit && pathParts.length > 0) {
        pathParts.pop(); // remove immediate parent directory name since init represents it
      }

      const prefix = matchedMapping.robloxPath;
      robloxHierarchy = prefix ? [prefix, ...pathParts].filter(Boolean).join('.') : pathParts.join('.');
    } else {
      // Fallback: use directory structure under src/
      let parts = normPath.split('/');
      if (parts[0] === 'src') parts.shift();
      parts.pop(); // remove filename

      if (isInit && parts.length > 0) {
        parts.pop();
      }
      robloxHierarchy = parts.join('.');
    }

    const fullRobloxPath = robloxHierarchy ? `${robloxHierarchy}.${scriptName}` : scriptName;

    return {
      scriptName,
      scriptType,
      isInit,
      robloxHierarchy,
      fullRobloxPath,
      relPath: normPath
    };
  }
}

module.exports = RojoParser;
