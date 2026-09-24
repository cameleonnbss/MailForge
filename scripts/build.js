// language: JavaScript, file: scripts/build.js
// Build orchestrator for the Windows targets.
//
// electron-builder unpacks its own signing tool cache (winCodeSign) by default.
// That archive contains macOS symlinks, so on a Windows machine without Developer
// Mode (and without administrator rights) the extraction fails with "cannot create
// symbolic link". This script detects that condition once and picks the path that
// works:
//
//   symlinks available  ->  electron-builder --win            (standard pipeline)
//   symlinks refused    ->  --dir with signAndEditExecutable=false, then stamp the
//                           executable with rcedit, then build the targets from the
//                           pre-packaged directory
//
// Both paths produce the same artifacts: installer, portable exe, branded icon and
// version metadata. No elevation, no code-signing certificate.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
/* Run Electron's builder through node with the script path, not the .bin shim:
   the project path can contain spaces and non-ASCII characters, which a shell
   shim mangles on Windows. */
const CLI = path.join(ROOT, 'node_modules', 'electron-builder', 'out', 'cli', 'cli.js');
const UNPACKED = path.join(ROOT, 'release', 'win-unpacked');

/** Can this process create a symbolic link? (Windows: needs Developer Mode or admin.) */
function canCreateSymlinks() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mailforge-symlink-'));
  try {
    fs.symlinkSync('target', path.join(dir, 'link'));
    return true;
  } catch {
    return false;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function run(args) {
  const result = spawnSync(process.execPath, [CLI, ...args], { cwd: ROOT, stdio: 'inherit' });
  if (result.error) {
    process.stderr.write(`build: electron-builder injoignable (${result.error.message}). Lancez npm install.\n`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status === null ? 1 : result.status);
}

function main() {
  const dirOnly = process.argv.includes('--dir');

  if (!fs.existsSync(CLI)) {
    process.stderr.write('build: electron-builder absent. Lancez npm install.\n');
    return 1;
  }

  const symlinks = canCreateSymlinks();
  const fallback = !symlinks && process.platform === 'win32';

  if (process.platform !== 'win32') {
    process.stdout.write('build: cibles Windows uniquement (electron-builder --win).\n');
  }
  process.stdout.write(
    fallback
      ? 'build: liens symboliques refuses par le systeme (pas de mode developpeur) -> chemin de remplacement\n'
      : 'build: chaine standard electron-builder\n'
  );

  if (!fallback) {
    run(dirOnly ? ['--win', '--dir'] : ['--win']);
    return 0;
  }

  run(['--win', '--dir', '--config.win.signAndEditExecutable=false']);

  const brands = require('./brand-exe.js');
  if (brands.main() !== 0) {
    process.stdout.write(
      'build: avertissement — icone et metadonnees non appliquees (rcedit indisponible).\n' +
        'L executable fonctionne mais garde l identite Electron. Pour corriger : activez le mode\n' +
        'developpeur Windows (Parametres > Systeme > Pour les developpeurs) puis relancez npm run dist.\n'
    );
  }

  if (dirOnly) return 0;

  if (!fs.existsSync(UNPACKED)) {
    process.stderr.write(`build: dossier prepackage introuvable — ${UNPACKED}\n`);
    return 1;
  }
  run(['--win', 'nsis', 'portable', '--prepackaged', path.relative(ROOT, UNPACKED)]);
  return 0;
}

if (require.main === module) process.exit(main());

module.exports = { main, canCreateSymlinks };
