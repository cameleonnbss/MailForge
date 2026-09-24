// language: JavaScript, file: src/core/services/tempmail.js
// Temporary mailbox manager. Every backend is a provider object with the same
// small contract, so adding one means adding one entry to PROVIDERS.
'use strict';

const crypto = require('crypto');

/** @typedef {{id:string,from:{name:string,address:string},subject:string,date:string,snippet:string,seen:boolean}} MailSummary */

const PROVIDERS = {
  mailtm: {
    id: 'mailtm',
    label: 'mail.tm',
    description: 'API publique officielle, comptes jetables, duree de vie configurable.',
    docs: 'https://docs.mail.tm/',
    stable: true,
    async create() {
      const domains = await getJson('https://api.mail.tm/domains');
      const domain = domains['hydra:member']?.[0]?.domain;
      if (!domain) throw new Error('mail.tm: aucun domaine disponible.');
      const local = `mf${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
      const address = `${local}@${domain}`;
      const password = crypto.randomBytes(9).toString('base64url');
      await postJson('https://api.mail.tm/accounts', { address, password });
      const token = await postJson('https://api.mail.tm/token', { address, password });
      return { address, token: token.token, meta: { password } };
    },
    async poll(session) {
      const data = await getJson('https://api.mail.tm/messages?page=1', session.token);
      return (data['hydra:member'] || []).map((item) => ({
        id: item.id,
        from: { name: item.from?.name || '', address: item.from?.address || '' },
        subject: item.subject || '(sans objet)',
        date: item.createdAt,
        snippet: item.intro || '',
        seen: Boolean(item.seen)
      }));
    },
    async read(session, id) {
      const data = await getJson(`https://api.mail.tm/messages/${id}`, session.token);
      return {
        id,
        from: { name: data.from?.name || '', address: data.from?.address || '' },
        to: (data.to || []).map((entry) => entry.address).join(', '),
        subject: data.subject || '(sans objet)',
        date: data.createdAt,
        text: data.text || '',
        html: Array.isArray(data.html) ? data.html.join('\n') : data.html || '',
        attachments: []
      };
    },
    async destroy(session) {
      await del(`https://api.mail.tm/accounts/${encodeURIComponent(session.address)}`, session.token);
    }
  },

  maildrop: {
    id: 'maildrop',
    label: 'Maildrop',
    description: 'Aucune inscription, boite publique. Ne pas utiliser pour des donnees sensibles.',
    docs: 'https://maildrop.cc/',
    stable: false,
    async create() {
      const address = `${crypto.randomBytes(6).toString('hex')}@maildrop.cc`;
      return { address, token: null, meta: {} };
    },
    async poll(session) {
      const mailbox = session.address.split('@')[0];
      const data = await getJson(`https://api.maildrop.cc/v2/mailbox/${mailbox}`, null, { 'x-api-key': 'test' });
      const items = Array.isArray(data) ? data : data.messages || [];
      return items.map((item) => ({
        id: item.id,
        from: { name: '', address: item.headerfrom || item.from || '' },
        subject: item.subject || '(sans objet)',
        date: item.date || new Date().toISOString(),
        snippet: item.intro || '',
        seen: false
      }));
    },
    async read(session, id) {
      const mailbox = session.address.split('@')[0];
      const data = await getJson(`https://api.maildrop.cc/v2/mailbox/${mailbox}/${id}`, null, {
        'x-api-key': 'test'
      });
      return {
        id,
        from: { name: '', address: data.headerfrom || data.from || '' },
        to: session.address,
        subject: data.subject || '(sans objet)',
        date: data.date || new Date().toISOString(),
        text: data.plain || data.body || '',
        html: data.html || '',
        attachments: data.attachments || []
      };
    },
    async destroy() {
      return true;
    }
  },

  guerrilla: {
    id: 'guerrilla',
    label: 'Guerrilla Mail',
    description: 'API ajax publique, boite jetable en une requete.',
    docs: 'https://www.guerrillamail.com/GuerrillaMailAPI.html',
    stable: true,
    async create() {
      const data = await getJson(
        'https://api.guerrillamail.com/ajax.php?f=get_email_address&lang=fr&ip=127.0.0.1&agent=MailForge'
      );
      return { address: data.email_addr, token: data.sid_token, meta: { alias: data.alias } };
    },
    async poll(session) {
      const data = await getJson(
        `https://api.guerrillamail.com/ajax.php?f=check_email&seq=0&sid_token=${encodeURIComponent(session.token)}`
      );
      return (data.list || []).map((item) => ({
        id: String(item.mail_id),
        from: { name: '', address: item.mail_from || '' },
        subject: item.mail_subject || '(sans objet)',
        date: new Date(Number(item.mail_timestamp) * 1000).toISOString(),
        snippet: item.mail_excerpt || '',
        seen: item.mail_read === 1
      }));
    },
    async read(session, id) {
      const data = await getJson(
        `https://api.guerrillamail.com/ajax.php?f=fetch_email&email_id=${encodeURIComponent(id)}&sid_token=${encodeURIComponent(session.token)}`
      );
      return {
        id,
        from: { name: '', address: data.mail_from || '' },
        to: data.mail_recipient || session.address,
        subject: data.mail_subject || '(sans objet)',
        date: new Date(Number(data.mail_timestamp) * 1000).toISOString(),
        text: data.mail_body || '',
        html: data.mail_body || '',
        attachments: []
      };
    },
    async destroy(session) {
      await getJson(
        `https://api.guerrillamail.com/ajax.php?f=forget_me&sid_token=${encodeURIComponent(session.token)}`
      );
    }
  }
};

async function request(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { Accept: 'application/json', ...(options.headers || {}) }
    });
    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText} — ${raw.slice(0, 180)}`);
    }
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return { raw };
    }
  } finally {
    clearTimeout(timer);
  }
}

function getJson(url, token, extraHeaders) {
  return request(url, {
    headers: token ? { Authorization: `Bearer ${token}`, ...(extraHeaders || {}) } : extraHeaders
  });
}

function postJson(url, body) {
  return request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

function del(url, token) {
  return request(url, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {} });
}

class TempMailManager {
  constructor(store) {
    this.store = store;
    this.cache = new Map();
  }

  listProviders() {
    return Object.values(PROVIDERS).map(({ id, label, description, docs, stable }) => ({
      id,
      label,
      description,
      docs,
      stable
    }));
  }

  boxes() {
    return this.store.get('tempmail.boxes', []);
  }

  #persist(boxes) {
    this.store.set('tempmail.boxes', boxes);
  }

  async create(providerId) {
    const provider = PROVIDERS[providerId] || PROVIDERS[this.store.get('tempmail.activeProvider', 'mailtm')];
    if (!provider) throw new Error(`Fournisseur inconnu: ${providerId}`);
    const session = await provider.create();
    const box = {
      id: crypto.randomUUID(),
      provider: provider.id,
      label: provider.label,
      address: session.address,
      token: session.token,
      meta: session.meta || {},
      createdAt: new Date().toISOString(),
      unread: 0,
      received: 0
    };
    const boxes = [box, ...this.boxes()].slice(0, 25);
    this.#persist(boxes);
    this.store.bumpStat('tempMailboxes');
    this.store.log('success', `Boite temporaire creee: ${box.address} (${provider.label})`, { scope: 'tempmail' });
    return box;
  }

  find(boxId) {
    const box = this.boxes().find((item) => item.id === boxId);
    if (!box) throw new Error('Boite introuvable.');
    return box;
  }

  async poll(boxId) {
    const box = this.find(boxId);
    const provider = PROVIDERS[box.provider];
    if (!provider) throw new Error(`Fournisseur indisponible: ${box.provider}`);
    const messages = await provider.poll(box);
    const boxes = this.boxes().map((item) =>
      item.id === box.id
        ? { ...item, lastPoll: new Date().toISOString(), unread: messages.filter((m) => !m.seen).length, received: messages.length }
        : item
    );
    this.#persist(boxes);
    return messages.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  async read(boxId, messageId) {
    const box = this.find(boxId);
    const provider = PROVIDERS[box.provider];
    if (!provider) throw new Error(`Fournisseur indisponible: ${box.provider}`);
    const message = await provider.read(box, messageId);
    this.cache.set(`${boxId}:${messageId}`, message);
    return message;
  }

  async destroy(boxId) {
    const box = this.find(boxId);
    const provider = PROVIDERS[box.provider];
    try {
      if (provider?.destroy) await provider.destroy(box);
    } catch (error) {
      this.store.log('warn', `Suppression distante impossible (${box.address}): ${error.message}`, { scope: 'tempmail' });
    }
    this.#persist(this.boxes().filter((item) => item.id !== boxId));
    return true;
  }

  forgetAll() {
    this.#persist([]);
    return true;
  }
}

module.exports = { TempMailManager, PROVIDERS };
