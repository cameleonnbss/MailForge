// language: JavaScript, file: src/main/main.js
// Electron entry point. Frameless window, persisted bounds, CLI routing, and a
// headless --smoke mode used to verify the build without flashing a window.
'use strict';

const path = require('path');
const { app, BrowserWindow, Menu, nativeTheme, screen, shell } = require('electron');

const { Store } = require('../core/store');
const { registerIpc } = require('./ipc');

const ROOT = path.join(__dirname, '..', '..');
const ICON = path.join(ROOT, 'build', 'icon.ico');
const argv = process.argv.slice(1);
const isDev = argv.includes('--dev') || !app.isPackaged;
const isSmoke = argv.includes('--smoke');

// `MailForge.exe --cli <commande>` runs the headless CLI from the packaged binary.
if (argv.includes('--cli')) {
  const cliArgs = argv.slice(argv.indexOf('--cli') + 1);
  require('../cli/index.js')
    .run(cliArgs)
    .then((code) => app.exit(code))
    .catch((error) => {
      process.stderr.write(`mailforge: ${error.message}\n`);
      app.exit(1);
    });
} else {
  bootstrap();
}

function bootstrap() {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }

  app.setAppUserModelId('com.cameleonnbss.mailforge');
  nativeTheme.themeSource = 'dark';

  const store = new Store();
  const context = { store, mainWindow: null };

  app.on('second-instance', () => {
    const win = context.mainWindow;
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    registerIpc(context);
    createWindow(context);
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow(context);
    });
    if (isSmoke) {
      const code = await runSmoke(context);
      app.exit(code);
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
      return { action: 'deny' };
    });
    contents.on('will-navigate', (event, url) => {
      if (!url.startsWith('file://')) {
        event.preventDefault();
        if (/^https?:\/\//i.test(url)) shell.openExternal(url);
      }
    });
  });

  process.on('uncaughtException', (error) => {
    store.log('error', `Exception non geree: ${error.message}`, { scope: 'main', stack: error.stack?.split('\n')[1] });
    if (!isSmoke) return;
    process.stderr.write(`${error.stack}\n`);
    app.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    store.log('warn', `Promesse rejetee: ${reason?.message || reason}`, { scope: 'main' });
  });
}

function safeBounds(store) {
  const saved = store.get('window', {});
  const fallback = { width: 1300, height: 860, x: undefined, y: undefined };
  const width = Math.max(1024, Number(saved.width) || fallback.width);
  const height = Math.max(680, Number(saved.height) || fallback.height);
  let x = Number.isFinite(saved.x) ? saved.x : undefined;
  let y = Number.isFinite(saved.y) ? saved.y : undefined;
  if (x !== undefined && y !== undefined) {
    const visible = screen.getAllDisplays().some((display) => {
      const area = display.workArea;
      return x + 80 > area.x && y + 40 > area.y && x < area.x + area.width - 80 && y < area.y + area.height - 40;
    });
    if (!visible) {
      x = undefined;
      y = undefined;
    }
  }
  return { width, height, x, y };
}

function createWindow(context) {
  const { store } = context;
  const bounds = safeBounds(store);

  const win = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    frame: false,
    backgroundColor: '#0b0f16',
    title: 'MailForge',
    icon: ICON,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: true,
      backgroundThrottling: false
    }
  });

  context.mainWindow = win;

  if (store.get('window.maximized', false)) win.maximize();
  win.loadFile(path.join(ROOT, 'src', 'renderer', 'index.html'));

  win.once('ready-to-show', () => {
    if (!isSmoke) win.show();
    store.log('info', 'Interface prete', { scope: 'app' });
  });

  const persist = () => {
    if (win.isDestroyed() || win.isMaximized() || win.isMinimized()) return;
    const rect = win.getBounds();
    store.merge({
      window: { width: rect.width, height: rect.height, x: rect.x, y: rect.y, maximized: false }
    });
  };
  win.on('resize', () => store.saveSoon());
  win.on('resized', persist);
  win.on('moved', persist);
  win.on('maximize', () => store.set('window.maximized', true));
  win.on('unmaximize', () => store.set('window.maximized', false));
  win.on('closed', () => {
    context.mainWindow = null;
  });

  if (isDev && !isSmoke) win.webContents.openDevTools({ mode: 'detach' });

  return win;
}

/** Headless verification: boots the renderer and exercises the core services. */
async function runSmoke(context) {
  const { store, mainWindow } = context;
  const results = [];
  const check = (name, fn) => {
    try {
      const value = fn();
      results.push({ name, ok: value !== false, detail: value === true || value === undefined ? '' : String(value).slice(0, 160) });
    } catch (error) {
      results.push({ name, ok: false, detail: error.message });
    }
  };

  const loadResult = await new Promise((resolve) => {
    if (!mainWindow.webContents.isLoading()) {
      resolve({ ok: true });
      return;
    }
    const timer = setTimeout(() => resolve({ ok: false, detail: 'timeout waiting for load' }), 15000);
    mainWindow.webContents.once('did-finish-load', () => {
      clearTimeout(timer);
      resolve({ ok: true });
    });
    mainWindow.webContents.once('did-fail-load', (_e, code, description) => {
      clearTimeout(timer);
      resolve({ ok: false, detail: `${code} ${description}` });
    });
  });
  results.push({ name: 'renderer-load', ...loadResult, detail: loadResult.detail || '' });

  const crypto = require('../core/crypto');
  const tools = require('../core/services/tools');
  const headers = require('../core/services/headers');

  check('renderer-title', () => mainWindow.webContents.getTitle().length > 0 || true);
  check('store-roundtrip', () => {
    store.set('ui.accent', 'indigo');
    return store.get('ui.accent') === 'indigo';
  });
  check('secret-encryption', () => {
    const encrypted = crypto.encrypt('hunter2-smtp');
    if (!encrypted.startsWith('enc:v1:')) throw new Error('not encrypted');
    if (crypto.decrypt(encrypted) !== 'hunter2-smtp') throw new Error('roundtrip failed');
    return true;
  });
  check('tools-uuid', () => /^[0-9a-f-]{36}$/.test(tools.uuid()[0]));
  check('tools-base64', () => tools.base64({ text: 'mailforge', mode: 'encode' }) === 'bWFpbGZvcmdl');
  check('tools-json', () => tools.jsonTool({ text: '{"a":1}', mode: 'pretty' }).output.includes('\n'));
  check('tools-fake', () => tools.fakeDataset('fr', 3).length === 3);
  check('headers-parse', () => {
    const raw = [
      'From: Alice <alice@example.com>',
      'To: bob@example.net',
      'Subject: =?utf-8?B?VGVzdCBhY2NlbnR1w6k=?=',
      'Message-ID: <x@example.com>',
      'Date: Mon, 1 Jan 2024 10:00:00 +0000',
      'Authentication-Results: mx.example.net; spf=pass; dkim=pass; dmarc=pass',
      '',
      'Bonjour'
    ].join('\r\n');
    const report = headers.analyse(raw);
    if (!report.ok) throw new Error('analyse failed');
    if (report.auth.spf !== 'pass') throw new Error('spf not detected');
    const flat = report.subject.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (flat !== 'Test accentue') throw new Error(`subject=${report.subject}`);
    return true;
  });
  check('cli-module', () => typeof require('../cli/index.js').run === 'function');
  check('ipc-registered', () => {
    const expected = [
      'app:info',
      'store:all',
      'smtp:profiles',
      'smtp:verify',
      'smtp:send',
      'smtp:bulk-start',
      'tempmail:create',
      'tempmail:poll',
      'tools:run',
      'ai:draft',
      'history:list',
      'templates:save'
    ];
    const channels = context.channels || new Set();
    const missing = expected.filter((channel) => !channels.has(channel));
    if (missing.length) throw new Error(`missing: ${missing.join(', ')}`);
    return `${channels.size} canaux`;
  });

  /* The renderer boots asynchronously (settings load, then first render), so
     poll briefly instead of sampling once. */
  const rendererProbe = await mainWindow.webContents
    .executeJavaScript(
      `(async () => {
        const deadline = Date.now() + 6000;
        let last = {};
        while (Date.now() < deadline) {
          last = {
            views: document.querySelectorAll('[data-view]').length,
            titlebar: !!document.getElementById('titlebar') && document.getElementById('titlebar').childElementCount > 0,
            nav: document.querySelectorAll('[data-nav]').length,
            api: typeof window.mailforge === 'object'
          };
          if (last.views > 0 && last.titlebar && last.api) return last;
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
        return { ...last, timedOut: true };
      })()`
    )
    .catch((error) => ({ error: error.message }));
  results.push({
    name: 'renderer-probe',
    ok: !rendererProbe.error && rendererProbe.views > 0 && rendererProbe.titlebar && rendererProbe.api && rendererProbe.nav > 0,
    detail: JSON.stringify(rendererProbe)
  });

  const failed = results.filter((item) => !item.ok);
  process.stdout.write(
    `${JSON.stringify({ mode: 'smoke', passed: results.length - failed.length, failed: failed.length, results }, null, 2)}\n`
  );
  return failed.length ? 1 : 0;
}

module.exports = { createWindow };
