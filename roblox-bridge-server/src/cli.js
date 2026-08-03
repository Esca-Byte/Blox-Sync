#!/usr/bin/env node

const readline = require('readline');
const path = require('path');
const os = require('os');
const fs = require('fs-extra');
const RobloxBridgeServer = require('./server');

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

const BASE_PROJECTS_DIR = path.join(getDefaultDocumentsDir(), 'RobloxProjects');

async function main() {
  await fs.ensureDir(BASE_PROJECTS_DIR);

  const args = process.argv.slice(2);
  let cmdProjectName = null;
  if (args.length > 0) {
    if ((args[0] === 'create' || args[0] === 'new') && args[1]) {
      cmdProjectName = args[1];
    } else if (args[0] === '--name' || args[0] === '-n') {
      cmdProjectName = args[1];
    } else if (!args[0].startsWith('-')) {
      cmdProjectName = args[0];
    }
  }

  if (cmdProjectName) {
    const cleanName = cmdProjectName.trim();
    console.log(`\nCreating/Selecting project '${cleanName}' in ${BASE_PROJECTS_DIR}...`);
    const server = new RobloxBridgeServer({
      baseProjectsDir: BASE_PROJECTS_DIR,
      activeProjectName: cleanName
    });
    await server.start();
    return;
  }

  console.log(`
=================================================
  🎮 Roblox Universal IDE Bridge CLI v2.0.0
=================================================
  IDE-Agnostic Roblox Sync Engine
  Projects Directory: ${BASE_PROJECTS_DIR}
=================================================
`);

  const entries = await fs.readdir(BASE_PROJECTS_DIR, { withFileTypes: true });
  const existingProjects = entries.filter(e => e.isDirectory()).map(e => e.name);

  if (existingProjects.length === 0) {
    console.log(`No existing projects found. Creating 'MyRobloxGame'...`);
    const server = new RobloxBridgeServer({
      baseProjectsDir: BASE_PROJECTS_DIR,
      activeProjectName: 'MyRobloxGame'
    });
    await server.start();
    return;
  }

  console.log(`Available Projects:`);
  existingProjects.forEach((p, idx) => {
    console.log(`  [${idx + 1}] ${p}`);
  });
  console.log(`  [C] Create New Project`);
  console.log(`  [Default: 1 - ${existingProjects[0]}]\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Select a project number or [C] to create new: ', async (answer) => {
    rl.close();
    let selectedProject = existingProjects[0];

    const input = answer.trim().toUpperCase();
    if (input === 'C') {
      const rl2 = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      rl2.question('Enter new project name: ', async (projName) => {
        rl2.close();
        const cleanName = projName.trim() || 'NewRobloxProject';
        const server = new RobloxBridgeServer({
          baseProjectsDir: BASE_PROJECTS_DIR,
          activeProjectName: cleanName
        });
        await server.start();
      });
      return;
    }

    const num = parseInt(input, 10);
    if (!isNaN(num) && num >= 1 && num <= existingProjects.length) {
      selectedProject = existingProjects[num - 1];
    }

    const server = new RobloxBridgeServer({
      baseProjectsDir: BASE_PROJECTS_DIR,
      activeProjectName: selectedProject
    });
    await server.start();
  });
}

if (require.main === module) {
  main().catch(console.error);
}
