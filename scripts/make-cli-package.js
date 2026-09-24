// language: JavaScript, file: scripts/make-cli-package.js
// Stages and zips the CLI-only distribution: the shared core plus the CLI
// entry point, no Electron, no build step. Output: release/MailForge-<version>-cli.zip
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const pkg = require(path.join(ROOT, 'package.json'));
const RELEASE = path.join(ROOT, 'release');
const STAGE = path.join(RELEASE, 'cli-package');
const ZIP = path.join(RELEASE, `MailForge-${pkg.version}-cli.zip`);

const SEVEN_ZIP = path.join(ROOT, 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe');

function copyDir(from, to, filter = () => true) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const destination = path.join(to, entry.name);
    if (entry.isDirectory()) {
      if (!filter(source)) continue;
      copyDir(source, destination, filter);
    } else if (filter(source)) {
      fs.copyFileSync(source, destination);
    }
  }
}

function main() {
  fs.rmSync(STAGE, { recursive: true, force: true });
  fs.mkdirSync(STAGE, { recursive: true });

  copyDir(path.join(ROOT, 'src', 'core'), path.join(STAGE, 'src', 'core'));
  copyDir(path.join(ROOT, 'src', 'cli'), path.join(STAGE, 'src', 'cli'));
  for (const file of ['LEGAL.md', 'LICENSE', 'README.md', 'CHANGELOG.md']) {
    fs.copyFileSync(path.join(ROOT, file), path.join(STAGE, file));
  }

  const cliPackage = {
    name: 'mailforge-cli',
    version: pkg.version,
    description: `${pkg.description} (ligne de commande seule)`,
    license: pkg.license,
    author: pkg.author,
    bin: { mailforge: 'src/cli/index.js' },
    main: 'src/cli/index.js',
    engines: { node: '>=18' },
    dependencies: { nodemailer: pkg.dependencies.nodemailer },
    repository: { type: 'git', url: 'https://github.com/cameleonnbss/MailForge.git' }
  };
  fs.writeFileSync(path.join(STAGE, 'package.json'), `${JSON.stringify(cliPackage, null, 2)}\n`);

  fs.writeFileSync(
    path.join(STAGE, 'INSTALL.md'),
    `# MailForge CLI — installation

Node.js 18 ou superieur requis. Aucune compilation, aucune interface graphique.

\`\`\`bash
npm install                 # installe nodemailer
node src/cli/index.js help  # liste des commandes
node src/cli/index.js version
\`\`\`

Installation globale de la commande \`mailforge\` :

\`\`\`bash
npm install -g .
mailforge profiles list
mailforge tools uuid --count 5
mailforge headers --file message.eml
\`\`\`

La configuration est partagee avec l'application de bureau : elle vit dans
\`%APPDATA%\\MailForge\\mailforge.json\` sous Windows, ou dans le dossier indique par
la variable \`MAILFORGE_DATA_DIR\`.

Usage legal, ethique et educatif uniquement — voir LEGAL.md. Le createur n'est pas
responsable de l'usage qui en est fait.

Depot : https://github.com/cameleonnbss/MailForge — Discord : cameleonmortis
`
  );

  if (!fs.existsSync(SEVEN_ZIP)) {
    process.stderr.write(`7za introuvable: ${SEVEN_ZIP}\n`);
    return 1;
  }
  fs.rmSync(ZIP, { force: true });
  execFileSync(SEVEN_ZIP, ['a', '-tzip', '-mx=9', ZIP, '.'], { cwd: STAGE, stdio: 'pipe' });
  fs.rmSync(STAGE, { recursive: true, force: true });

  const size = fs.statSync(ZIP).size;
  process.stdout.write(`CLI package: ${path.relative(ROOT, ZIP)} (${(size / 1024).toFixed(0)} Ko)\n`);
  return 0;
}

if (require.main === module) process.exit(main());

module.exports = { main };
