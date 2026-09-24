// language: JavaScript, file: scripts/brand-exe.js
// Stamps the icon and version metadata onto the packaged executable.
//
// Why this exists: electron-builder normally does this itself, but on a Windows
// machine without Developer Mode it cannot extract its signing-tool cache (the
// archive contains macOS symlinks, which require SeCreateSymbolicLinkPrivilege).
// The same tool it would use — rcedit — is reused here, so the build produces a
// branded executable with no administrator rights and no code-signing cert.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const pkg = require(path.join(ROOT, 'package.json'));

const UNPACKED = path.join(ROOT, 'release', 'win-unpacked');
const TARGET = path.join(UNPACKED, `${pkg.build?.productName || pkg.productName || 'MailForge'}.exe`);
const ICON = path.join(ROOT, 'build', 'icon.ico');

/** Locate rcedit in the electron-builder cache (no vendored binary). */
function findRcedit() {
  const cache = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'electron-builder', 'Cache', 'winCodeSign');
  if (!fs.existsSync(cache)) return null;
  for (const entry of fs.readdirSync(cache)) {
    const candidate = path.join(cache, entry, 'rcedit-x64.exe');
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function main() {
  if (process.platform !== 'win32') {
    process.stdout.write('brand: ignore (cible Windows uniquement)\n');
    return 0;
  }
  if (!fs.existsSync(TARGET)) {
    process.stderr.write(`brand: executable introuvable — ${TARGET}\nLancez d'abord "npm run pack".\n`);
    return 1;
  }

  const rcedit = findRcedit();
  if (!rcedit) {
    process.stderr.write(
      'brand: rcedit introuvable dans le cache electron-builder.\n' +
        'Lancez une fois "npm run pack" pour que le cache soit peuple, puis relancez.\n'
    );
    return 1;
  }

  const version = pkg.version;
  const args = [
    TARGET,
    '--set-icon', ICON,
    '--set-version-string', 'ProductName', pkg.build?.productName || 'MailForge',
    '--set-version-string', 'FileDescription', `${pkg.build?.productName || 'MailForge'} — ${pkg.description.split('.')[0]}`.slice(0, 200),
    '--set-version-string', 'CompanyName', 'cameleonnbss',
    '--set-version-string', 'LegalCopyright', `MIT — cameleonnbss (${pkg.build?.copyright || ''})`.slice(0, 200),
    '--set-version-string', 'OriginalFilename', path.basename(TARGET),
    '--set-file-version', version,
    '--set-product-version', version
  ];

  try {
    execFileSync(rcedit, args, { stdio: 'pipe' });
  } catch (error) {
    process.stderr.write(`brand: rcedit a echoue — ${error.stderr?.toString() || error.message}\n`);
    return 1;
  }

  process.stdout.write(`brand: ${path.relative(ROOT, TARGET)} — icone et metadonnees v${version} appliquees\n`);
  return 0;
}

if (require.main === module) process.exit(main());

module.exports = { main, findRcedit, TARGET };
