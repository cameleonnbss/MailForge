// language: JavaScript, file: src/core/store.js
// Tiny persistent JSON store: atomic writes, dotted-path access, debounced flush.
// No external dependency, shared by the Electron main process and the CLI.
'use strict';

const fs = require('fs');
const path = require('path');
const { configFile, ensureDir, dataDir } = require('./paths');

const DEFAULT_STATE = {
  version: 1,
  installedAt: null,
  window: { width: 1300, height: 860, x: null, y: null, maximized: false },
  ui: {
    theme: 'dark',
    accent: 'indigo',
    animations: true,
    compact: false,
    language: 'fr',
    lastView: 'dashboard'
  },
  smtp: {
    profiles: [],
    activeProfileId: null
  },
  send: {
    defaultFromName: '',
    throttleMs: 4000,
    jitterMs: 1500,
    dailyCap: 200,
    unsubscribeFooter: true,
    unsubscribeText:
      'Vous recevez ce message car vous vous etes inscrit sur notre liste. Pour vous desinscrire, repondez STOP.'
  },
  tempmail: {
    activeProvider: 'mailtm',
    autoRefreshSec: 12,
    providers: {
      mailtm: { label: 'mail.tm', enabled: true },
      maildrop: { label: 'Maildrop', enabled: true },
      guerrilla: { label: 'Guerrilla Mail', enabled: true }
    }
  },
  ai: {
    activeProviderId: 'groq',
    language: 'fr',
    tone: 'professionnel',
    length: 'moyen',
    customInstructions: '',
    providers: []
  },
  history: [],
  logs: [],
  snippets: [],
  templates: [],
  suppression: [],
  stats: { sentTotal: 0, failedTotal: 0, bytesSent: 0, tempMailboxes: 0 }
};

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(base, patch) {
  if (!isPlainObject(patch)) return patch === undefined ? base : patch;
  const out = Array.isArray(base) ? base.slice() : { ...base };
  for (const [key, value] of Object.entries(patch)) {
    out[key] = isPlainObject(value) && isPlainObject(out[key]) ? deepMerge(out[key], value) : value;
  }
  return out;
}

function getPath(obj, dotted) {
  return String(dotted)
    .split('.')
    .reduce((acc, key) => (acc === undefined || acc === null ? acc : acc[key]), obj);
}

function setPath(obj, dotted, value) {
  const keys = String(dotted).split('.');
  let cursor = obj;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    if (!isPlainObject(cursor[key]) && !Array.isArray(cursor[key])) cursor[key] = {};
    cursor = cursor[key];
  }
  cursor[keys[keys.length - 1]] = value;
  return obj;
}

class Store {
  constructor(file = configFile()) {
    this.file = file;
    this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    this._timer = null;
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.file)) {
        const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
        this.state = deepMerge(this.state, raw);
      }
    } catch (error) {
      const broken = `${this.file}.corrupt-${Date.now()}`;
      try {
        fs.renameSync(this.file, broken);
      } catch {
        /* ignore */
      }
      this.lastError = `Config unreadable (${error.message}). Backup at ${broken}`;
    }
    if (!this.state.installedAt) {
      this.state.installedAt = new Date().toISOString();
      this.save();
    }
    return this.state;
  }

  get(dotted, fallback) {
    const value = getPath(this.state, dotted);
    return value === undefined ? fallback : value;
  }

  set(dotted, value) {
    setPath(this.state, dotted, value);
    this.save();
    return value;
  }

  merge(patch) {
    this.state = deepMerge(this.state, patch);
    this.save();
    return this.state;
  }

  replace(next) {
    this.state = deepMerge(JSON.parse(JSON.stringify(DEFAULT_STATE)), next || {});
    this.save();
    return this.state;
  }

  reset(keepSecrets = true) {
    const secrets = keepSecrets ? this.state.smtp : null;
    this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    this.state.installedAt = new Date().toISOString();
    if (secrets) this.state.smtp = secrets;
    this.save();
    return this.state;
  }

  save() {
    clearTimeout(this._timer);
    this._timer = null;
    try {
      ensureDir(path.dirname(this.file));
      const tmp = `${this.file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2), 'utf8');
      fs.renameSync(tmp, this.file);
    } catch (error) {
      this.lastError = error.message;
    }
    return this;
  }

  saveSoon(delay = 400) {
    if (this._timer) return this;
    this._timer = setTimeout(() => {
      this._timer = null;
      this.save();
    }, delay);
    if (this._timer.unref) this._timer.unref();
    return this;
  }

  /** Append a log line, keeping the ring buffer bounded. */
  log(level, message, extra = {}) {
    const entry = { ts: new Date().toISOString(), level, message, ...extra };
    this.state.logs.push(entry);
    if (this.state.logs.length > 800) this.state.logs.splice(0, this.state.logs.length - 800);
    this.saveSoon();
    return entry;
  }

  /** Record a send in the history ring, newest first. */
  recordSend(entry) {
    this.state.history.unshift(entry);
    if (this.state.history.length > 500) this.state.history.length = 500;
    this.saveSoon();
    return entry;
  }

  bumpStat(key, delta = 1) {
    this.state.stats[key] = (this.state.stats[key] || 0) + delta;
    this.saveSoon();
  }

  dataDir() {
    return dataDir();
  }
}

module.exports = { Store, DEFAULT_STATE, deepMerge };
