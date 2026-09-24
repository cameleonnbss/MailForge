// language: JavaScript, file: src/core/crypto.js
// AES-256-GCM at-rest encryption for stored credentials (SMTP passwords, API keys).
// Key material lives in a 0600 keyfile inside the app data dir; the GUI prefers
// Electron safeStorage when the OS keychain is available.
'use strict';

const fs = require('fs');
const crypto = require('crypto');
const { keyFile, ensureDir, dataDir } = require('./paths');

const PREFIX = 'enc:v1:';

let cachedKey = null;

function loadKey() {
  if (cachedKey) return cachedKey;
  ensureDir(dataDir());
  const file = keyFile();
  if (fs.existsSync(file)) {
    const raw = fs.readFileSync(file, 'utf8').trim();
    if (/^[0-9a-f]{64}$/i.test(raw)) {
      cachedKey = Buffer.from(raw, 'hex');
      return cachedKey;
    }
  }
  const fresh = crypto.randomBytes(32);
  fs.writeFileSync(file, fresh.toString('hex'), { mode: 0o600 });
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    /* best effort on Windows */
  }
  cachedKey = fresh;
  return cachedKey;
}

function encrypt(plain) {
  if (plain === null || plain === undefined || plain === '') return '';
  if (typeof plain === 'string' && plain.startsWith(PREFIX)) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', loadKey(), iv);
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + [iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':');
}

function decrypt(payload) {
  if (!payload) return '';
  if (!String(payload).startsWith(PREFIX)) return String(payload);
  try {
    const [, , ivB64, tagB64, ctB64] = String(payload).split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', loadKey(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

function mask(secret) {
  const value = decrypt(secret);
  if (!value) return '';
  if (value.length <= 6) return '\u2022'.repeat(value.length);
  return value.slice(0, 3) + '\u2022'.repeat(Math.min(12, value.length - 6)) + value.slice(-3);
}

module.exports = { encrypt, decrypt, mask, PREFIX };
