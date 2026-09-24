// language: JavaScript, file: src/cli/index.js
// MailForge CLI — same core services as the desktop app, no Electron, no window.
// Reachable as `npm run cli -- <cmd>` or `MailForge.exe --cli <cmd>`.
'use strict';

const fs = require('fs');
const path = require('path');

const { Store } = require('../core/store');
const crypto = require('../core/crypto');
const { dataDir, exportsDir, ensureDir } = require('../core/paths');
const { Mailer } = require('../core/services/smtp');
const { TempMailManager } = require('../core/services/tempmail');
const { AiWriter } = require('../core/services/ai');
const toolsSvc = require('../core/services/tools');
const { runTool } = require('../core/services/run-tool');
const { parseRecipientList } = require('../core/services/recipients');
const headersSvc = require('../core/services/headers');
const { listProtocols } = require('../core/services/apis');

const VERSION = require('../../package.json').version;

const HELP = `
MailForge CLI v${VERSION}

Usage: mailforge <commande> [options]

  profiles list                          Lister les profils d'envoi
  profiles add --label X --host smtp... --port 587 --user U --password P --from A
  profiles rm <id>                       Supprimer un profil
  profiles use <id>                      Definir le profil actif
  protocols                              Lister les transports API disponibles
  test [profileId]                       Tester la connexion (SMTP ou API)
  send --to A --subject S [--text F|--html F] [--from X] [--attach F]... 
  campaign --list F.csv --subject S (--html F|--text F) [--throttle 4000] [--dry-run]
  temp new [--provider mailtm|maildrop|guerrilla]
  temp boxes | temp poll --box ID | temp read --box ID --id MSG
  tools <id> [--text T] [options]        fake-data, password, uuid, base64, json,
                                         hash, lorem, timestamp, color, case, stats
  headers --file raw.eml                 Analyse d'en-tetes (SPF/DKIM/DMARC, delais)
  ai draft --brief "..." [--provider groq] [--model M]  (cle requise en config)
  logs [--limit 50] [--level error]
  config get <cle> | config set <cle> <valeur> | config path
  export [--out fichier.json]            Export complet de la configuration
  version | help

Global:  --json  sortie machine    --data <dir>  dossier de donnees
`;

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const [rawKey, inline] = token.slice(2).split('=');
      const key = rawKey.trim();
      if (inline !== undefined) {
        flags[key] = inline;
      } else if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
        flags[key] = argv[++i];
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(token);
    }
  }
  return { positional, flags };
}

function list(value) {
  if (value === undefined || value === true) return [];
  return Array.isArray(value) ? value : [value];
}

function readMaybeFile(value) {
  if (!value || value === true) return '';
  if (fs.existsSync(value)) return fs.readFileSync(value, 'utf8');
  return String(value);
}

function out(value, asJson) {
  if (asJson) process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  else process.stdout.write(`${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`);
}

function table(rows, columns) {
  if (!rows.length) return '(vide)';
  const widths = columns.map((column) =>
    Math.max(column.label.length, ...rows.map((row) => String(row[column.key] ?? '').length))
  );
  const line = (cells) => cells.map((cell, index) => String(cell).padEnd(widths[index])).join('  ');
  return [
    line(columns.map((column) => column.label)),
    widths.map((width) => '-'.repeat(width)).join('  '),
    ...rows.map((row) => line(columns.map((column) => row[column.key] ?? '')))
  ].join('\n');
}

function resolveStoreDir(flags) {
  if (flags.data) process.env.MAILFORGE_DATA_DIR = path.resolve(String(flags.data));
  return new Store();
}

async function run(argv = process.argv.slice(2)) {
  const { positional, flags } = parseArgs(argv);
  const asJson = Boolean(flags.json);
  const command = positional[0];

  if (!command || command === 'help' || flags.help) {
    process.stdout.write(HELP);
    return 0;
  }
  if (command === 'version') {
    out({ name: 'mailforge', version: VERSION, node: process.version }, asJson);
    return 0;
  }

  const store = resolveStoreDir(flags);
  const mailer = new Mailer(store);

  switch (command) {
    case 'profiles':
      return profilesCommand(positional.slice(1), flags, store, asJson);
    case 'protocols':
      out(listProtocols(), asJson);
      return 0;
    case 'test': {
      const id = positional[1] || store.get('smtp.activeProfileId');
      const profiles = store.get('smtp.profiles', []);
      if (!profiles.length) throw new Error("Aucun profil. Ajoutez-en un avec: profiles add --host ... --user ... --password ...");
      const profile = decryptProfile(profiles.find((item) => item.id === id) || profiles[0]);
      const result = await mailer.verify(profile);
      if (asJson) out(result, true);
      else process.stdout.write(`${result.ok ? 'OK  ' : 'FAIL'} ${result.ms} ms — ${result.message}\n${result.hint ? `     ${result.hint}\n` : ''}`);
      return result.ok ? 0 : 2;
    }
    case 'send':
      return sendCommand(flags, store, mailer, asJson);
    case 'campaign':
      return campaignCommand(flags, store, mailer, asJson);
    case 'temp':
      return tempCommand(positional.slice(1), flags, store, asJson);
    case 'tools':
      return toolsCommand(positional.slice(1), flags, asJson);
    case 'headers': {
      const raw = flags.file ? fs.readFileSync(String(flags.file), 'utf8') : readMaybeFile(flags.text);
      if (!raw) throw new Error('Fournissez --file raw.eml ou --text "...".');
      const report = headersSvc.analyse(raw);
      if (asJson) {
        out(report, true);
      } else if (!report.ok) {
        process.stdout.write(`${report.error}\n`);
      } else {
        process.stdout.write(
          [
            `Sujet      : ${report.subject}`,
            `De         : ${report.from.name} <${report.from.address}>`,
            `SPF/DKIM/DMARC : ${report.auth.spf || '-'} / ${report.auth.dkim || '-'} / ${report.auth.dmarc || '-'}`,
            `Headers    : ${report.counts.headers} (${report.counts.received} Received)`,
            `Headers dupliques : ${report.duplicated.map((item) => item.name).join(', ') || 'aucun'}`,
            '',
            ...report.flags.map((flag) => `[${flag.level.toUpperCase()}] ${flag.title} — ${flag.detail}`),
            '',
            'Chaine Received:',
            ...report.received.map(
              (hop) => `  ${hop.index}. ${hop.from || '?'} -> ${hop.by || '?'} ${hop.delayMs ? `(+${hop.delayMs} ms)` : ''}`
            )
          ].join('\n') + '\n'
        );
      }
      return report.ok ? 0 : 2;
    }
    case 'ai':
      return aiCommand(positional.slice(1), flags, store, asJson);
    case 'logs': {
      const limit = Number(flags.limit) || 50;
      const level = flags.level && flags.level !== true ? String(flags.level) : 'all';
      const rows = store
        .get('logs', [])
        .filter((row) => level === 'all' || row.level === level)
        .slice(-limit)
        .reverse();
      if (asJson) out(rows, true);
      else process.stdout.write(table(rows, [
        { key: 'ts', label: 'Horodatage' },
        { key: 'level', label: 'Niveau' },
        { key: 'scope', label: 'Portee' },
        { key: 'message', label: 'Message' }
      ]) + '\n');
      return 0;
    }
    case 'config': {
      const [action, key, ...rest] = positional.slice(1);
      if (!action || action === 'path') {
        out({ dataDir: dataDir(), config: path.join(dataDir(), 'mailforge.json') }, asJson);
        return 0;
      }
      if (action === 'get') {
        out({ [key]: store.get(key) }, asJson);
        return 0;
      }
      if (action === 'set') {
        const raw = [rest.join(' ')].find((value) => value !== undefined) ?? flags.value;
        if (!key || raw === undefined) throw new Error('Usage: config set <cle> <valeur>');
        let parsed = raw;
        try {
          parsed = JSON.parse(String(raw));
        } catch {
          /* keep as string */
        }
        store.set(key, parsed);
        store.log('info', `Config ${key} = ${JSON.stringify(parsed)}`, { scope: 'cli' });
        out({ [key]: parsed }, asJson);
        return 0;
      }
      throw new Error(`Action inconnue: ${action}`);
    }
    case 'export': {
      const payload = {
        generatedAt: new Date().toISOString(),
        app: { name: 'MailForge', version: VERSION },
        state: { ...store.state, smtp: { ...store.state.smtp, profiles: store.state.smtp.profiles.map(maskForExport) } }
      };
      const target = flags.out ? path.resolve(String(flags.out)) : path.join(ensureDir(exportsDir()), `mailforge-export-${Date.now()}.json`);
      ensureDir(path.dirname(target));
      fs.writeFileSync(target, JSON.stringify(payload, null, 2), 'utf8');
      out({ saved: true, file: target }, asJson);
      return 0;
    }
    default:
      process.stdout.write(HELP);
      return command === 'gui' ? 0 : 1;
  }
}

function maskForExport(profile) {
  const copy = { ...profile };
  for (const field of ['password', 'apiKey']) {
    if (copy[field]) copy[field] = '***';
  }
  if (copy.dkim?.privateKey) copy.dkim = { ...copy.dkim, privateKey: '***' };
  return copy;
}

function decryptProfile(profile) {
  const out2 = { ...profile };
  for (const field of ['password', 'apiKey']) out2[field] = crypto.decrypt(profile[field]);
  if (profile.dkim?.privateKey) out2.dkim = { ...profile.dkim, privateKey: crypto.decrypt(profile.dkim.privateKey) };
  return out2;
}

function profilesCommand(args, flags, store, asJson) {
  const action = args[0] || 'list';
  const profiles = store.get('smtp.profiles', []);
  if (action === 'list') {
    const rows = profiles.map((profile) => ({
      id: profile.id,
      label: profile.label,
      transport: profile.transport,
      target: profile.transport === 'api' ? `${profile.protocol}:${profile.endpoint || profile.domain || ''}` : `${profile.host}:${profile.port}`,
      user: profile.user,
      active: store.get('smtp.activeProfileId') === profile.id ? '*' : ''
    }));
    if (asJson) out(rows, true);
    else
      process.stdout.write(
        table(rows, [
          { key: 'id', label: 'ID' },
          { key: 'active', label: 'A' },
          { key: 'label', label: 'Libelle' },
          { key: 'transport', label: 'Transport' },
          { key: 'target', label: 'Cible' },
          { key: 'user', label: 'Utilisateur' }
        ]) + '\n'
      );
    return 0;
  }
  if (action === 'add') {
    const isApi = String(flags.transport || 'smtp') === 'api';
    const record = {
      id: `p${Date.now().toString(36)}`,
      label: String(flags.label || flags.host || flags.protocol || 'Profil CLI'),
      transport: isApi ? 'api' : 'smtp',
      protocol: String(flags.protocol || (isApi ? 'generic' : 'smtp')),
      host: String(flags.host || ''),
      port: Number(flags.port) || 587,
      secure: flags.secure === true || flags.secure === 'true' || Number(flags.port) === 465,
      user: String(flags.user || ''),
      from: String(flags.from || flags.user || ''),
      fromName: String(flags.name || ''),
      domain: String(flags.domain || ''),
      endpoint: String(flags.endpoint || ''),
      rejectUnauthorized: flags.insecure !== true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (!record.host && !isApi) throw new Error('--host requis pour un profil SMTP.');
    const stored = {
      ...record,
      password: flags.password ? crypto.encrypt(String(flags.password)) : '',
      apiKey: flags['api-key'] ? crypto.encrypt(String(flags['api-key'])) : ''
    };
    store.set('smtp.profiles', [...profiles, stored]);
    if (!store.get('smtp.activeProfileId')) store.set('smtp.activeProfileId', record.id);
    store.log('success', `Profil ${record.id} ajoute via CLI`, { scope: 'cli' });
    out({ created: record.id, profile: record }, asJson);
    return 0;
  }
  if (action === 'rm' || action === 'remove') {
    const id = args[1];
    if (!id) throw new Error('Usage: profiles rm <id>');
    const next = profiles.filter((profile) => profile.id !== id);
    if (next.length === profiles.length) throw new Error(`Profil introuvable: ${id}`);
    store.set('smtp.profiles', next);
    if (store.get('smtp.activeProfileId') === id) store.set('smtp.activeProfileId', next[0]?.id || null);
    out({ removed: id }, asJson);
    return 0;
  }
  if (action === 'use') {
    const id = args[1];
    if (!profiles.some((profile) => profile.id === id)) throw new Error(`Profil introuvable: ${id}`);
    store.set('smtp.activeProfileId', id);
    out({ active: id }, asJson);
    return 0;
  }
  throw new Error(`Action inconnue: ${action}`);
}

async function sendCommand(flags, store, mailer, asJson) {
  const to = String(flags.to || '');
  if (!to) throw new Error('--to requis.');
  const profiles = store.get('smtp.profiles', []);
  if (!profiles.length) throw new Error('Aucun profil. Utilisez: profiles add ...');
  const profile = decryptProfile(profiles.find((item) => item.id === store.get('smtp.activeProfileId')) || profiles[0]);

  const attachments = [];
  for (const file of list(flags.attach)) {
    const stat = fs.statSync(file);
    attachments.push({
      filename: path.basename(file),
      content: fs.readFileSync(file).toString('base64'),
      contentType: 'application/octet-stream',
      size: stat.size
    });
  }

  const message = {
    from: String(flags.from || profile.from || profile.user),
    to: to.split(/[,;\s]+/).filter(Boolean),
    subject: String(flags.subject || '(sans objet)'),
    text: flags.text ? readMaybeFile(flags.text) : undefined,
    html: flags.html ? readMaybeFile(flags.html) : undefined,
    attachments,
    replyTo: flags.reply ? String(flags.reply) : undefined
  };
  if (!message.text && !message.html) message.text = ' ';

  const result = await mailer.sendOne(profile, message);
  store.recordSend({
    ts: new Date().toISOString(),
    kind: 'cli',
    to,
    subject: message.subject,
    ok: result.ok,
    error: result.error || null,
    messageId: result.id || null,
    ms: result.ms
  });
  store.bumpStat(result.ok ? 'sentTotal' : 'failedTotal');
  if (asJson) out(result, true);
  else process.stdout.write(`${result.ok ? 'OK  ' : 'FAIL'} ${result.ms} ms ${result.ok ? `id=${result.id}` : `— ${result.error}`}\n`);
  return result.ok ? 0 : 2;
}

async function campaignCommand(flags, store, mailer, asJson) {
  const listFile = flags.list;
  if (!listFile || listFile === true) throw new Error('--list fichier.csv requis.');
  const text = fs.readFileSync(String(listFile), 'utf8');
  const { recipients, invalid, duplicates } = parseRecipientList(text);
  if (!recipients.length) throw new Error('Aucun destinataire valide dans la liste.');
  if (invalid || duplicates) {
    process.stderr.write(`Liste: ${invalid} ligne(s) ignoree(s), ${duplicates} doublon(s).\n`);
  }

  const thickness = Number(flags.throttle) || store.get('send.throttleMs', 4000);
  const message = {
    subject: String(flags.subject || '(sans objet)'),
    html: flags.html ? readMaybeFile(flags.html) : undefined,
    text: flags.text ? readMaybeFile(flags.text) : undefined
  };

  if (flags['dry-run']) {
    out({ recipients: recipients.length, throttleMs: thickness, sample: recipients.slice(0, 5) }, asJson);
    return 0;
  }

  process.stdout.write(`Campagne: ${recipients.length} destinataires, ${thickness} ms entre chaque envoi.\n`);
  const summary = await mailer.sendBulk({
    recipients,
    message,
    throttleMs: thickness,
    jitterMs: Number(flags.jitter) || store.get('send.jitterMs', 1500),
    unsubscribedFooter: store.get('send.unsubscribeFooter', true),
    onProgress: ({ index, total, email, ok, error }) => {
      process.stdout.write(`[${index}/${total}] ${ok ? 'OK  ' : 'FAIL'} ${email}${error ? ` — ${error}` : ''}\n`);
    }
  });
  store.bumpStat('sentTotal', summary.sent);
  store.bumpStat('failedTotal', summary.failed);
  out(summary, asJson);
  return summary.failed ? 3 : 0;
}

async function tempCommand(args, flags, store, asJson) {
  const temp = new TempMailManager(store);
  const action = args[0] || 'boxes';
  if (action === 'providers') {
    out(temp.listProviders(), asJson);
    return 0;
  }
  if (action === 'new') {
    const box = await temp.create(flags.provider ? String(flags.provider) : undefined);
    out(box, asJson);
    return 0;
  }
  if (action === 'boxes') {
    out(temp.boxes(), asJson);
    return 0;
  }
  if (action === 'poll') {
    const boxId = flags.box ? String(flags.box) : temp.boxes()[0]?.id;
    if (!boxId) throw new Error('Aucune boite. Lancez: temp new');
    const messages = await temp.poll(boxId);
    if (asJson) out(messages, true);
    else
      process.stdout.write(
        table(messages, [
          { key: 'date', label: 'Date' },
          { key: 'id', label: 'ID' },
          { key: 'subject', label: 'Sujet' },
          { key: 'snippet', label: 'Extrait' }
        ]) + '\n'
      );
    return 0;
  }
  if (action === 'read') {
    const boxId = flags.box ? String(flags.box) : temp.boxes()[0]?.id;
    if (!boxId || !flags.id) throw new Error('Usage: temp read --box <id> --id <messageId>');
    out(await temp.read(boxId, String(flags.id)), asJson);
    return 0;
  }
  if (action === 'rm') {
    const boxId = flags.box ? String(flags.box) : temp.boxes()[0]?.id;
    if (!boxId) throw new Error('Aucune boite.');
    await temp.destroy(boxId);
    out({ removed: boxId }, asJson);
    return 0;
  }
  if (action === 'forget') {
    temp.forgetAll();
    out({ cleared: true }, asJson);
    return 0;
  }
  throw new Error(`Action inconnue: temp ${action}`);
}

async function toolsCommand(args, flags, asJson) {
  const id = args[0];
  if (!id) {
    process.stdout.write(table(toolsSvc.CATALOG, [
      { key: 'id', label: 'ID' },
      { key: 'group', label: 'Groupe' },
      { key: 'label', label: 'Outil' }
    ]) + '\n');
    return 0;
  }
  const text = flags.text ? readMaybeFile(flags.text) : '';
  const result = runTool(id, { ...flags, text });
  if (asJson) out(result, true);
  else if (typeof result === 'string') process.stdout.write(`${result}\n`);
  else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return 0;
}

async function aiCommand(args, flags, store, asJson) {
  const action = args[0];
  if (action !== 'draft') throw new Error('Usage: ai draft --brief "..." [--provider id] [--lang fr] [--tone ...]');
  const ai = new AiWriter(store);
  const saved = store.get('ai.providers', []).find((item) => item.id === (flags.provider || store.get('ai.activeProviderId')));
  const draft = await ai.draft({
    providerId: flags.provider ? String(flags.provider) : undefined,
    brief: String(flags.brief || ''),
    language: flags.lang ? String(flags.lang) : store.get('ai.language'),
    tone: flags.tone ? String(flags.tone) : store.get('ai.tone'),
    length: flags.length ? String(flags.length) : store.get('ai.length'),
    context: flags.context ? String(flags.context) : '',
    apiKey: crypto.decrypt(saved?.apiKey || '')
  });
  if (asJson) out(draft, true);
  else process.stdout.write(`${draft.subject ? `Sujet: ${draft.subject}\n\n` : ''}${draft.text || draft.html}\n`);
  return 0;
}

module.exports = { run, parseArgs };

if (require.main === module) {
  run()
    .then((code) => process.exit(code))
    .catch((error) => {
      process.stderr.write(`mailforge: ${error.message}\n`);
      process.exit(1);
    });
}
