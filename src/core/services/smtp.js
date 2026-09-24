// language: JavaScript, file: src/core/services/smtp.js
// Transport layer: SMTP via nodemailer, or an HTTP mail API.
// Provides connection verification, single sends, and a throttled bulk queue.
'use strict';

const { EventEmitter } = require('events');
const nodemailer = require('nodemailer');
const { getProtocol } = require('./apis');

const MIN_THROTTLE_MS = 1000;

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    if (!signal) return;
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error('aborted'));
    };
    if (signal.aborted) return onAbort();
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function normalizeAddressList(value) {
  if (!value) return [];
  const raw = Array.isArray(value) ? value : String(value).split(/[,;\n]+/);
  return raw.map((item) => item.trim()).filter(Boolean);
}

function normaliseRecipient(entry) {
  if (typeof entry === 'string') return { email: entry.trim(), vars: {} };
  const email = String(entry.email || entry.mail || entry.address || '').trim();
  const vars = { ...entry };
  delete vars.email;
  return { email, vars };
}

function substitute(template, vars) {
  if (!template) return template;
  return String(template).replace(/\{\{\s*([\w.@-]+)\s*\}\}|\{\s*([\w.@-]+)\s*\}/g, (match, double, single) => {
    const key = double || single;
    const value = vars[key];
    return value === undefined || value === null ? match : String(value);
  });
}

class Mailer extends EventEmitter {
  constructor(store) {
    super();
    this.store = store;
    this.controller = null;
    this.busy = false;
  }

  /** Resolve a profile by id (or accept an inline profile object). */
  resolveProfile(profileOrId) {
    if (profileOrId && typeof profileOrId === 'object') return { ...profileOrId };
    const profiles = this.store.get('smtp.profiles', []);
    const id = profileOrId || this.store.get('smtp.activeProfileId');
    const found = profiles.find((profile) => profile.id === id) || profiles[0];
    if (!found) throw new Error("Aucun profil d'envoi configure. Ajoutez-en un dans Parametres > Envoi.");
    return { ...found };
  }

  buildTransport(profile) {
    const secure = profile.secure === true || Number(profile.port) === 465;
    const transport = nodemailer.createTransport({
      host: profile.host,
      port: Number(profile.port) || 587,
      secure,
      pool: profile.pool !== false,
      maxConnections: 1,
      maxMessages: 50,
      auth: profile.user
        ? { user: profile.user, pass: profile.password, method: profile.authMethod || undefined }
        : undefined,
      connectionTimeout: Number(profile.timeoutMs) || 15000,
      greetingTimeout: 10000,
      socketTimeout: 30000,
      requireTLS: profile.requireTls === true,
      tls: {
        rejectUnauthorized: profile.rejectUnauthorized !== false,
        servername: profile.host
      },
      dkim: profile.dkim?.domainName
        ? {
            domainName: profile.dkim.domainName,
            keySelector: profile.dkim.keySelector || 'mail',
            privateKey: profile.dkim.privateKey
          }
        : undefined,
      logger: false
    });
    return transport;
  }

  /** Live connection test: DNS/TCP/TLS/AUTH in one shot. */
  async verify(profileOrId) {
    const profile = this.resolveProfile(profileOrId);
    const started = Date.now();
    let result;
    try {
      result = await this.buildTransport(profile).verify();
    } catch (error) {
      const elapsed = Date.now() - started;
      const hint = diagnose(error);
      this.store.log('error', `Test SMTP echoue (${profile.host}:${profile.port}) — ${error.message}`, {
        scope: 'smtp'
      });
      return { ok: false, ms: elapsed, message: error.message, code: error.code || null, hint };
    }
    const elapsed = Date.now() - started;
    this.store.log('success', `Connexion ${profile.host}:${profile.port} validee en ${elapsed} ms`, {
      scope: 'smtp'
    });
    return {
      ok: true,
      ms: elapsed,
      message: result || 'Serveur pret a accepter des messages.',
      hint: 'Connexion, TLS et authentification valides.'
    };
  }

  buildRawMessage(profile, message, overrides = {}) {
    const merged = { ...message, ...overrides };
    const attachments = (merged.attachments || []).map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content ? Buffer.from(attachment.content, 'base64') : undefined,
      path: attachment.content ? undefined : attachment.path,
      contentType: attachment.contentType || undefined
    }));
    return {
      from: merged.fromName ? { name: merged.fromName, address: merged.from } : merged.from,
      to: normalizeAddressList(merged.to),
      cc: normalizeAddressList(merged.cc),
      bcc: normalizeAddressList(merged.bcc),
      replyTo: merged.replyTo || undefined,
      subject: merged.subject || '(sans objet)',
      text: merged.text || undefined,
      html: merged.html || undefined,
      attachments,
      headers: merged.headers || undefined,
      list: merged.listUnsubscribe
        ? { unsubscribe: { url: merged.listUnsubscribe, comment: 'Unsubscribe' } }
        : undefined
    };
  }

  /** Send exactly one message. API transports bypass SMTP entirely. */
  async sendOne(profileOrId, message) {
    const profile = this.resolveProfile(profileOrId);
    const started = Date.now();
    if (profile.transport === 'api') {
      const protocol = getProtocol(profile.protocol || 'generic');
      const payload = {
        from: message.from || profile.from || profile.user,
        fromName: message.fromName || this.store.get('send.defaultFromName', ''),
        to: normalizeAddressList(message.to),
        cc: normalizeAddressList(message.cc),
        bcc: normalizeAddressList(message.bcc),
        replyTo: message.replyTo || undefined,
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachments: message.attachments || []
      };
      try {
        const result = await protocol.send({ ...profile, apiKey: profile.apiKey }, payload);
        return { ok: true, id: result.id, response: result.response, ms: Date.now() - started };
      } catch (error) {
        return { ok: false, error: error.message, ms: Date.now() - started };
      }
    }

    const transporter = this.buildTransport(profile);
    try {
      const info = await transporter.sendMail(this.buildRawMessage(profile, message));
      return {
        ok: true,
        id: info.messageId,
        response: info.response,
        accepted: info.accepted,
        rejected: info.rejected,
        ms: Date.now() - started
      };
    } catch (error) {
      return {
        ok: false,
        error: error.message,
        code: error.code || null,
        response: error.response || null,
        ms: Date.now() - started
      };
    } finally {
      try {
        transporter.close();
      } catch {
        /* ignore */
      }
    }
  }

  cancel() {
    if (this.controller) this.controller.abort();
    return true;
  }

  /**
   * Consent-based bulk send: one message per recipient, strictly sequential,
   * with a configurable delay between messages and a hard floor of 1 s.
   * `onProgress` receives {index,total,recipient,ok,error,id}.
   */
  async sendBulk({ profileId, recipients, message, throttleMs, jitterMs, unsubscribedFooter, onProgress }) {
    if (this.busy) throw new Error('Une campagne est deja en cours.');
    const profile = this.resolveProfile(profileId);
    const list = (recipients || []).map(normaliseRecipient).filter((entry) => entry.email);
    if (!list.length) throw new Error('Aucun destinataire valide.');

    const suppression = new Set(
      (this.store.get('suppression', []) || []).map((item) => String(item).toLowerCase())
    );
    const { kept, skipped } = list.reduce(
      (acc, entry) => {
        if (suppression.has(entry.email.toLowerCase())) acc.skipped.push(entry.email);
        else acc.kept.push(entry);
        return acc;
      },
      { kept: [], skipped: [] }
    );

    const delay = Math.max(MIN_THROTTLE_MS, Number(throttleMs) || 4000);
    const jitter = Math.max(0, Number(jitterMs) || 0);
    const footer = unsubscribedFooter
      ? `<hr style="border:none;border-top:1px solid #ddd;margin:24px 0"><p style="font-size:12px;color:#888">${this.store.get('send.unsubscribeText', '')}</p>`
      : '';

    this.busy = true;
    this.controller = new AbortController();
    const signal = this.controller.signal;
    const startedAt = Date.now();
    const results = [];

    this.emit('bulk:start', { total: kept.length, skipped: skipped.length, delayMs: delay });

    try {
      for (let index = 0; index < kept.length; index += 1) {
        if (signal.aborted) break;
        const entry = kept[index];
        const vars = { ...entry.vars, email: entry.email, unsubscribe_url: message.unsubscribeUrl || '' };
        const personalised = {
          ...message,
          subject: substitute(message.subject, vars),
          text: message.text ? substitute(message.text, vars) : undefined,
          html: message.html ? substitute(message.html, vars) + footer : footer || undefined
        };

        const outcome = await this.sendOne(profile, {
          ...personalised,
          from: message.from || profile.from || profile.user,
          to: entry.email,
          listUnsubscribe: message.unsubscribeUrl || undefined
        });

        const record = {
          email: entry.email,
          ok: outcome.ok,
          error: outcome.error || null,
          id: outcome.id || null,
          ms: outcome.ms
        };
        results.push(record);
        this.emit('bulk:progress', { index: index + 1, total: kept.length, ...record });
        if (onProgress) onProgress({ index: index + 1, total: kept.length, ...record });

        const isLast = index === kept.length - 1;
        if (!isLast) {
          const wait = delay + (jitter ? Math.floor(Math.random() * jitter) : 0);
          this.emit('bulk:wait', { ms: wait, next: kept[index + 1].email });
          await sleep(wait, signal);
        }
      }
    } catch (error) {
      if (error.message !== 'aborted') this.emit('bulk:error', { message: error.message });
    } finally {
      this.busy = false;
      this.controller = null;
    }

    const summary = {
      total: kept.length,
      sent: results.filter((item) => item.ok).length,
      failed: results.filter((item) => !item.ok).length,
      skipped: skipped.length,
      aborted: signal.aborted,
      elapsedMs: Date.now() - startedAt,
      results
    };
    this.emit('bulk:done', summary);
    return summary;
  }
}

function diagnose(error) {
  const code = error.code || '';
  const table = {
    ETIMEDOUT: 'Le serveur ne repond pas. Verifiez le port (587 STARTTLS / 465 SSL) et le pare-feu.',
    ECONNREFUSED: 'Connexion refusee. Port ferme ou mauvais hote.',
    EDNS: 'Nom d\'hote introuvable (DNS).',
    ENOTFOUND: 'Nom d\'hote introuvable (DNS).',
    EAUTH: 'Authentification refusee. Utilisez un mot de passe d\'application, pas le mot de passe du compte.',
    ESOCKET: 'Erreur socket — souvent un mismatch TLS. Essayez secure=true sur 465 ou requireTls sur 587.',
    'self signed certificate': 'Certificat non reconnu. Corrigez le certificat serveur plutot que de desactiver la verification.'
  };
  return table[code] || table[error.message] || 'Verifiez hote, port, chiffrement et identifiants.';
}

module.exports = { Mailer, normaliseRecipient, substitute, normalizeAddressList, MIN_THROTTLE_MS };
