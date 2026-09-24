// language: JavaScript, file: src/core/paths.js
// Resolves the shared data directory for both the GUI and the CLI.
// Electron's userData dir matches these paths, so both processes read one config.
'use strict';

const os = require('os');
const path = require('path');

const APP_SLUG = 'MailForge';

function dataDir() {
  if (process.env.MAILFORGE_DATA_DIR) return path.resolve(process.env.MAILFORGE_DATA_DIR);
  if (process.platform === 'win32') {
    const roaming = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(roaming, APP_SLUG);
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', APP_SLUG);
  }
  const xdg = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(xdg, APP_SLUG);
}

function configFile() {
  return path.join(dataDir(), 'mailforge.json');
}

function keyFile() {
  return path.join(dataDir(), 'secrets.key');
}

function exportsDir() {
  return path.join(dataDir(), 'exports');
}

function ensureDir(dir) {
  const fs = require('fs');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

module.exports = { APP_SLUG, dataDir, configFile, keyFile, exportsDir, ensureDir };
