// language: JavaScript, file: src/main/ipc.js
// One place for every renderer-facing capability. Handlers return an envelope
// {ok, data} | {ok:false, error} so the renderer never parses Electron errors.
'use strict';

const fs = require('fs');
const path = require('path');
const { ipcMain, dialog, shell, app, BrowserWindow } = require('electron');

const crypto = require('../core/crypto');
const toolsSvc = require('../core/services/tools');
const { runTool } = require('../core/services/run-tool');
const { parseRecipientList } = require('../core/services/recipients');
const { Mailer } = require('../core/services/smtp');
const { TempMailManager } = require('../core/services/tempmail');
const { AiWriter } = require('../core/services/ai');
const { listProtocols } = require('../core/services/apis');
const { exportsDir, ensureDir, dataDir } = require('../core/paths');

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

const SECRET_FIELDS = ['password', 'apiKey'];

function maskProfile(profile) {
  const out = { ...profile };
  for (const field of SECRET_FIELDS) {
    out[`${field}Set`] = Boolean(profile[field]);
    out[field] = '';
  }
  if (profile.dkim) {
    out.dkim = {
      domainName: profile.dkim.domainName || '',
      keySelector: profile.dkim.keySelector || 'mail',
      privateKeySet: Boolean(profile.dkim.privateKey),
      privateKey: ''
    };
  }
  return out;
}

function mergeSecrets(incoming, existing = {}) {
  const out = { ...existing, ...incoming };
  for (const field of SECRET_FIELDS) {
    if (!incoming[field] && existing[field]) out[field] = existing[field];
  }
  if (incoming.dkim) {
    out.dkim = {
      ...(existing.dkim || {}),
      ...incoming.dkim,
      privateKey: incoming.dkim.privateKey || existing.dkim?.privateKey || ''
    };
  }
  return out;
}

function decryptProfile(profile) {
  const out = { ...profile };
  for (const field of SECRET_FIELDS) {
    out[field] = crypto.decrypt(profile[field]);
  }
  if (profile.dkim?.privateKey) {
    out.dkim = { ...profile.dkim, privateKey: crypto.decrypt(profile.dkim.privateKey) };
  }
  return out;
}

function encryptProfile(profile) {
  const out = { ...profile };
  for (const field of SECRET_FIELDS) {
    if (profile[field]) out[field] = crypto.encrypt(profile[field]);
  }
  if (profile.dkim?.privateKey) {
    out.dkim = { ...profile.dkim, privateKey: crypto.encrypt(profile.dkim.privateKey) };
  }
  return out;
}

function registerIpc(context) {
  const { store } = context;
  const mailer = new Mailer(store);
  const temp = new TempMailManager(store);
  const ai = new AiWriter(store);
  context.mailer = mailer;
  context.temp = temp;
  context.ai = ai;

  const emit = (type, payload) => {
    const win = context.mainWindow || BrowserWindow.getAllWindows()[0];
    if (win && !win.isDestroyed()) win.webContents.send('app:event', { type, payload, ts: Date.now() });
  };

  mailer.on('bulk:start', (payload) => emit('bulk:start', payload));
  mailer.on('bulk:progress', (payload) => emit('bulk:progress', payload));
  mailer.on('bulk:wait', (payload) => emit('bulk:wait', payload));
  mailer.on('bulk:done', (payload) => emit('bulk:done', payload));
  mailer.on('bulk:error', (payload) => emit('bulk:error', payload));

  const LOG_LEVELS = new Set(['debug', 'info', 'success', 'warn', 'error']);

  /* Every channel is recorded so the smoke test can assert the full surface
     without reaching into Electron internals. */
  context.channels = new Set();

  function handle(channel, fn) {
    context.channels.add(channel);
    ipcMain.handle(channel, async (_event, payload) => {
      try {
        return { ok: true, data: await fn(payload ?? {}) };
      } catch (error) {
        if (channel !== 'log:write') store.log('error', `${channel} — ${error.message}`, { scope: 'ipc' });
        emit('log', { level: 'error', message: error.message, channel });
        return { ok: false, error: error.message };
      }
    });
  }

  /* ------------------------------------------------------------- app -- */

  handle('app:info', () => ({
    name: app.getName(),
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    packaged: app.isPackaged,
    dataDir: dataDir(),
    exportsDir: exportsDir()
  }));

  handle('app:open-external', async ({ url }) => {
    if (!/^https?:\/\//i.test(String(url))) throw new Error('URL refusee.');
    await shell.openExternal(url);
    return true;
  });

  handle('app:open-path', async ({ target }) => {
    const resolved = target || dataDir();
    const result = await shell.openPath(resolved);
    if (result) throw new Error(result);
    return true;
  });

  handle('app:pick-files', async () => {
    const result = await dialog.showOpenDialog(context.mainWindow ?? undefined, {
      title: 'Choisir des pieces jointes',
      properties: ['openFile', 'multiSelections']
    });
    if (result.canceled) return [];
    const files = [];
    for (const file of result.filePaths) {
      const stat = fs.statSync(file);
      if (stat.size > MAX_ATTACHMENT_BYTES) {
        files.push({ filename: path.basename(file), error: `Depasse 20 Mo (${(stat.size / 1048576).toFixed(1)} Mo)` });
        continue;
      }
      files.push({
        filename: path.basename(file),
        size: stat.size,
        contentType: guessType(file),
        content: fs.readFileSync(file).toString('base64')
      });
    }
    return files;
  });

  handle('app:save-file', async ({ defaultPath, content, filters, encoding = 'utf8' }) => {
    const result = await dialog.showSaveDialog(context.mainWindow ?? undefined, {
      defaultPath: defaultPath || path.join(exportsDir(), `mailforge-export-${Date.now()}.txt`),
      filters: filters || [{ name: 'Tous les fichiers', extensions: ['*'] }]
    });
    if (result.canceled || !result.filePath) return { saved: false };
    ensureDir(path.dirname(result.filePath));
    fs.writeFileSync(result.filePath, content, encoding);
    store.log('success', `Export ecrit: ${result.filePath}`, { scope: 'app' });
    return { saved: true, filePath: result.filePath, bytes: Buffer.byteLength(content, encoding) };
  });

  handle('app:read-file', async ({ filePath }) => {
    const content = fs.readFileSync(filePath, 'utf8');
    return { filePath, content };
  });

  /* --------------------------------------------------------- window -- */

  handle('window:minimize', () => {
    context.mainWindow?.minimize();
    return true;
  });
  handle('window:toggle-maximize', () => {
    const win = context.mainWindow;
    if (!win) return false;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
    return win.isMaximized();
  });
  handle('window:close', () => {
    context.mainWindow?.close();
    return true;
  });
  handle('window:state', () => ({
    maximized: Boolean(context.mainWindow?.isMaximized()),
    focused: Boolean(context.mainWindow?.isFocused()),
    fullscreen: Boolean(context.mainWindow?.isFullScreen())
  }));

  /* ---------------------------------------------------------- store -- */

  function publicState() {
    const state = JSON.parse(JSON.stringify(store.state));
    state.smtp.profiles = state.smtp.profiles.map(maskProfile);
    state.ai.providers = (state.ai.providers || []).map((provider) => ({ ...provider, apiKey: '' }));
    return state;
  }

  handle('store:all', () => publicState());
  handle('store:get', ({ key, fallback }) => store.get(key, fallback));
  handle('store:set', ({ key, value }) => {
    if (/^(smtp|ai)\./.test(key) && /password|apiKey|privateKey/i.test(key)) throw new Error('Utilisez les canaux dedies pour les secrets.');
    store.set(key, value);
    return store.get(key);
  });
  handle('store:merge', ({ patch }) => {
    const clean = JSON.parse(JSON.stringify(patch || {}));
    if (clean.smtp?.profiles) delete clean.smtp.profiles;
    if (clean.ai?.providers) delete clean.ai.providers;
    store.merge(clean);
    return publicState();
  });
  handle('store:reset', ({ keepSecrets = true }) => {
    store.reset(keepSecrets);
    return publicState();
  });
  handle('store:export', () => ({
    generatedAt: new Date().toISOString(),
    app: { name: app.getName(), version: app.getVersion() },
    state: publicState()
  }));
  handle('store:import', ({ json }) => {
    const parsed = typeof json === 'string' ? JSON.parse(json) : json;
    const incoming = parsed.state || parsed;
    if (!incoming || typeof incoming !== 'object') throw new Error('JSON invalide.');
    store.replace(incoming);
    return publicState();
  });

  /* ----------------------------------------------------------- logs -- */

  handle('log:write', ({ level, message, scope }) => {
    const safeLevel = LOG_LEVELS.has(level) ? level : 'info';
    const entry = store.log(safeLevel, String(message).slice(0, 500), { scope: scope || 'ui' });
    emit('log', entry);
    return entry;
  });
  handle('log:list', ({ limit = 300, level } = {}) => {
    const rows = store.get('logs', []);
    const filtered = level && level !== 'all' ? rows.filter((row) => row.level === level) : rows;
    return filtered.slice(-limit).reverse();
  });
  handle('log:clear', () => {
    store.set('logs', []);
    return true;
  });

  /* ---------------------------------------------------------- smtp -- */

  handle('smtp:profiles', () => ({
    profiles: store.get('smtp.profiles', []).map(maskProfile),
    activeProfileId: store.get('smtp.activeProfileId', null),
    protocols: listProtocols()
  }));

  handle('smtp:profile-save', ({ profile }) => {
    if (!profile || typeof profile !== 'object') throw new Error('Profil invalide.');
    const profiles = store.get('smtp.profiles', []);
    const id = profile.id || crypto.encrypt(`${Date.now()}`).slice(-12);
    const existing = profiles.find((item) => item.id === id);
    const merged = mergeSecrets(profile, existing);
    const record = {
      id,
      label: merged.label || merged.host || 'Profil sans nom',
      transport: merged.transport === 'api' ? 'api' : 'smtp',
      protocol: merged.protocol || 'smtp',
      host: merged.host || '',
      port: Number(merged.port) || 587,
      secure: Boolean(merged.secure),
      requireTls: Boolean(merged.requireTls),
      rejectUnauthorized: merged.rejectUnauthorized !== false,
      user: merged.user || '',
      from: merged.from || merged.user || '',
      fromName: merged.fromName || '',
      replyTo: merged.replyTo || '',
      domain: merged.domain || '',
      endpoint: merged.endpoint || '',
      authHeader: merged.authHeader || '',
      timeoutMs: Number(merged.timeoutMs) || 15000,
      dkim: merged.dkim || null,
      notes: merged.notes || '',
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const encrypted = encryptProfile({ ...record, password: merged.password, apiKey: merged.apiKey });
    const next = existing ? profiles.map((item) => (item.id === id ? encrypted : item)) : [...profiles, encrypted];
    store.set('smtp.profiles', next);
    if (!store.get('smtp.activeProfileId') || !existing) store.set('smtp.activeProfileId', id);
    store.log('success', `Profil d'envoi enregistre: ${record.label}`, { scope: 'smtp' });
    return { id, profiles: next.map(maskProfile), activeProfileId: store.get('smtp.activeProfileId') };
  });

  handle('smtp:profile-delete', ({ id }) => {
    const profiles = store.get('smtp.profiles', []).filter((item) => item.id !== id);
    store.set('smtp.profiles', profiles);
    const active = store.get('smtp.activeProfileId');
    if (active === id) store.set('smtp.activeProfileId', profiles[0]?.id || null);
    return { profiles: profiles.map(maskProfile), activeProfileId: store.get('smtp.activeProfileId') };
  });

  handle('smtp:profile-active', ({ id }) => {
    if (!store.get('smtp.profiles', []).some((item) => item.id === id)) throw new Error('Profil introuvable.');
    store.set('smtp.activeProfileId', id);
    return stored(id);
  });

  function stored(id) {
    const raw = store.get('smtp.profiles', []).find((item) => item.id === id) || store.get('smtp.profiles', [])[0];
    if (!raw) throw new Error("Aucun profil d'envoi.");
    return decryptProfile(raw);
  }

  handle('smtp:verify', ({ profileId, draft }) => {
    if (draft) {
      const incoming = mergeSecrets(draft, {});
      return mailer.verify(decryptProfile(incoming));
    }
    return mailer.verify(stored(profileId));
  });

  handle('smtp:send', async ({ profileId, message }) => {
    if (!message?.to) throw new Error('Destinataire manquant.');
    const profile = stored(profileId);
    const result = await mailer.sendOne(profile, message);
    store.recordSend({
      ts: new Date().toISOString(),
      kind: 'single',
      from: message.from || profile.from,
      to: message.to,
      cc: message.cc || '',
      subject: message.subject,
      ok: result.ok,
      error: result.error || null,
      messageId: result.id || null,
      response: result.response || null,
      ms: result.ms,
      attachments: (message.attachments || []).map((item) => item.filename)
    });
    store.bumpStat(result.ok ? 'sentTotal' : 'failedTotal');
    store.log(result.ok ? 'success' : 'error', result.ok ? `Envoye a ${message.to} (${result.ms} ms)` : `Echec ${message.to}: ${result.error}`, { scope: 'smtp' });
    return result;
  });

  handle('smtp:bulk-start', async ({ profileId, recipients, message, throttleMs, jitterMs }) => {
    if (!Array.isArray(recipients) || !recipients.length) throw new Error('Liste de destinataires vide.');
    if (recipients.length > 5000) throw new Error('Maximum 5000 destinataires par campagne.');
    store.log('info', `Campagne lancee: ${recipients.length} destinataires`, { scope: 'smtp' });
    const summary = await mailer.sendBulk({
      profileId,
      recipients,
      message,
      throttleMs: throttleMs ?? store.get('send.throttleMs', 4000),
      jitterMs: jitterMs ?? store.get('send.jitterMs', 1500),
      unsubscribedFooter: store.get('send.unsubscribeFooter', true)
    });
    store.recordSend({
      ts: new Date().toISOString(),
      kind: 'campaign',
      from: message.from,
      to: `${summary.total} destinataires`,
      subject: message.subject,
      ok: summary.failed === 0,
      error: summary.failed ? `${summary.failed} echec(s)` : null,
      sent: summary.sent,
      failed: summary.failed,
      skipped: summary.skipped,
      elapsedMs: summary.elapsedMs
    });
    store.bumpStat('sentTotal', summary.sent);
    store.bumpStat('failedTotal', summary.failed);
    store.log(
      summary.failed ? 'warn' : 'success',
      `Campagne terminee: ${summary.sent} envoyes, ${summary.failed} echecs, ${summary.skipped} exclus`,
      { scope: 'smtp' }
    );
    return summary;
  });

  handle('smtp:bulk-cancel', () => mailer.cancel());

  handle('smtp:parse-list', ({ text }) => {
    const parsed = parseRecipientList(text);
    const suppression = new Set(store.get('suppression', []).map((item) => String(item).toLowerCase()));
    return {
      ...parsed,
      suppressed: parsed.recipients.filter((row) => suppression.has(row.email.toLowerCase())).length
    };
  });

  handle('suppression:list', () => store.get('suppression', []));
  handle('suppression:add', ({ entries }) => {
    const current = new Set(store.get('suppression', []).map((item) => String(item).toLowerCase()));
    for (const entry of String(entries || '').split(/[\s,;\n]+/).filter(Boolean)) {
      if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(entry)) current.add(entry.toLowerCase());
    }
    store.set('suppression', [...current]);
    return [...current];
  });
  handle('suppression:remove', ({ email }) => {
    const next = store.get('suppression', []).filter((item) => item.toLowerCase() !== String(email).toLowerCase());
    store.set('suppression', next);
    return next;
  });

  handle('history:list', ({ limit = 200 } = {}) => store.get('history', []).slice(0, limit));
  handle('history:clear', () => {
    store.set('history', []);
    return true;
  });
  handle('history:export', ({ format = 'csv' } = {}) => {
    const rows = store.get('history', []);
    if (format === 'csv') return toolsSvc.toCsv(rows.map(({ attachments, response, ...rest }) => ({ ...rest, attachments: (attachments || []).join('|') })));
    return JSON.stringify(rows, null, 2);
  });

  /* ------------------------------------------------------ temporary -- */

  handle('tempmail:providers', () => ({
    providers: temp.listProviders(),
    activeProvider: store.get('tempmail.activeProvider', 'mailtm')
  }));
  handle('tempmail:create', ({ providerId }) => temp.create(providerId));
  handle('tempmail:boxes', () => temp.boxes());
  handle('tempmail:poll', ({ boxId }) => temp.poll(boxId));
  handle('tempmail:read', ({ boxId, messageId }) => temp.read(boxId, messageId));
  handle('tempmail:destroy', ({ boxId }) => temp.destroy(boxId));
  handle('tempmail:forget-all', () => temp.forgetAll());
  handle('tempmail:set-provider', ({ providerId }) => {
    if (!temp.listProviders().some((provider) => provider.id === providerId)) throw new Error('Fournisseur inconnu.');
    store.set('tempmail.activeProvider', providerId);
    return providerId;
  });

  /* ------------------------------------------------------------- ai -- */

  handle('ai:catalog', () => ({
    providers: ai.catalog(),
    activeProviderId: store.get('ai.activeProviderId', 'groq'),
    language: store.get('ai.language', 'fr'),
    tone: store.get('ai.tone', 'professionnel'),
    length: store.get('ai.length', 'moyen'),
    customInstructions: store.get('ai.customInstructions', '')
  }));

  handle('ai:save-provider', ({ id, apiKey, model, baseUrl, enabled, label }) => {
    const providers = store.get('ai.providers', []);
    const existing = providers.find((item) => item.id === id) || { id };
    const record = {
      ...existing,
      id,
      label: label || existing.label,
      model: model ?? existing.model,
      baseUrl: baseUrl ?? existing.baseUrl,
      enabled: enabled ?? existing.enabled ?? true,
      apiKey: apiKey ? crypto.encrypt(apiKey) : existing.apiKey || ''
    };
    const next = providers.some((item) => item.id === id)
      ? providers.map((item) => (item.id === id ? record : item))
      : [...providers, record];
    store.set('ai.providers', next);
    store.log('info', `Fournisseur IA mis a jour: ${id}`, { scope: 'ai' });
    return ai.catalog();
  });

  handle('ai:active', ({ id }) => {
    store.set('ai.activeProviderId', id);
    return id;
  });

  handle('ai:draft', async (payload) => {
    let apiKey = payload.apiKey;
    if (!apiKey) {
      const saved = store.get('ai.providers', []).find((item) => item.id === payload.providerId);
      apiKey = crypto.decrypt(saved?.apiKey || '');
    }
    return ai.draft({ ...payload, apiKey });
  });

  handle('ai:test', async ({ providerId, apiKey, baseUrl }) => {
    const saved = store.get('ai.providers', []).find((item) => item.id === providerId);
    return ai.test(providerId, {
      apiKey: apiKey || crypto.decrypt(saved?.apiKey || ''),
      baseUrl: baseUrl || saved?.baseUrl
    });
  });

  /* ---------------------------------------------------------- tools -- */

  handle('tools:catalog', () => toolsSvc.CATALOG);

  handle('tools:run', ({ id, params }) => runTool(id, params));

  handle('snippets:list', () => store.get('snippets', []));
  handle('snippets:save', ({ snippet }) => {
    const snippets = store.get('snippets', []);
    const record = {
      id: snippet.id || `${Date.now()}`,
      title: String(snippet.title || 'Sans titre').slice(0, 120),
      body: String(snippet.body || '').slice(0, 20000),
      tags: String(snippet.tags || '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      updatedAt: new Date().toISOString()
    };
    const next = snippets.some((item) => item.id === record.id)
      ? snippets.map((item) => (item.id === record.id ? record : item))
      : [record, ...snippets];
    store.set('snippets', next);
    return next;
  });
  handle('snippets:delete', ({ id }) => {
    const next = store.get('snippets', []).filter((item) => item.id !== id);
    store.set('snippets', next);
    return next;
  });

  handle('templates:list', () => store.get('templates', []));
  handle('templates:save', ({ template }) => {
    const templates = store.get('templates', []);
    const record = {
      id: template.id || `${Date.now()}`,
      name: String(template.name || 'Modele').slice(0, 120),
      subject: String(template.subject || '').slice(0, 300),
      html: String(template.html || '').slice(0, 200000),
      category: String(template.category || 'general').slice(0, 40),
      updatedAt: new Date().toISOString()
    };
    const next = templates.some((item) => item.id === record.id)
      ? templates.map((item) => (item.id === record.id ? record : item))
      : [record, ...templates];
    store.set('templates', next);
    return next;
  });
  handle('templates:delete', ({ id }) => {
    const next = store.get('templates', []).filter((item) => item.id !== id);
    store.set('templates', next);
    return next;
  });

  handle('app:stats', () => store.get('stats', {}));
}

function guessType(file) {
  const map = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.html': 'text/html',
    '.zip': 'application/zip',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  };
  return map[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

module.exports = { registerIpc, maskProfile };
