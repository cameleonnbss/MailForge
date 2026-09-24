// language: JavaScript, file: src/core/services/apis.js
// HTTP mail-API transports (the "API" half of "SMTP/API").
// Each adapter normalises the app's message shape into the provider payload.
'use strict';

/** @typedef {{from:string,fromName?:string,to:string[],cc?:string[],bcc?:string[],replyTo?:string,subject:string,text?:string,html?:string,attachments?:Array<{filename:string,contentType?:string,content?:string}>}} MailMessage */

const PROTOCOLS = {
  resend: {
    label: 'Resend',
    endpoint: 'https://api.resend.com/emails',
    docs: 'https://resend.com/docs/api-reference/emails/send-email',
    async send(profile, message) {
      return request(profile, 'POST', 'https://api.resend.com/emails', {
        from: decorateFrom(profile, message),
        to: message.to,
        cc: message.cc?.length ? message.cc : undefined,
        bcc: message.bcc?.length ? message.bcc : undefined,
        reply_to: message.replyTo || undefined,
        subject: message.subject,
        html: message.html || undefined,
        text: message.text || undefined,
        attachments: (message.attachments || []).map((a) => ({
          filename: a.filename,
          content: a.content
        }))
      });
    }
  },
  sendgrid: {
    label: 'SendGrid',
    endpoint: 'https://api.sendgrid.com/v3/mail/send',
    docs: 'https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send',
    async send(profile, message) {
      return request(profile, 'POST', 'https://api.sendgrid.com/v3/mail/send', {
        personalizations: [
          {
            to: message.to.map((email) => ({ email })),
            cc: message.cc?.length ? message.cc.map((email) => ({ email })) : undefined,
            bcc: message.bcc?.length ? message.bcc.map((email) => ({ email })) : undefined
          }
        ],
        from: { email: message.from, name: message.fromName || undefined },
        reply_to: message.replyTo ? { email: message.replyTo } : undefined,
        subject: message.subject,
        content: buildContent(message),
        attachments: (message.attachments || []).map((a) => ({
          filename: a.filename,
          content: a.content,
          type: a.contentType
        }))
      });
    }
  },
  brevo: {
    label: 'Brevo',
    endpoint: 'https://api.brevo.com/v3/smtp/email',
    docs: 'https://developers.brevo.com/reference/sendtransacemail',
    async send(profile, message) {
      return request(profile, 'POST', 'https://api.brevo.com/v3/smtp/email', {
        sender: { email: message.from, name: message.fromName || undefined },
        to: message.to.map((email) => ({ email })),
        cc: message.cc?.length ? message.cc.map((email) => ({ email })) : undefined,
        bcc: message.bcc?.length ? message.bcc.map((email) => ({ email })) : undefined,
        replyTo: message.replyTo ? { email: message.replyTo } : undefined,
        subject: message.subject,
        htmlContent: message.html || undefined,
        textContent: message.text || undefined,
        attachment: (message.attachments || []).map((a) => ({ name: a.filename, content: a.content }))
      });
    }
  },
  mailgun: {
    label: 'Mailgun',
    endpoint: 'https://api.mailgun.net/v3/{domain}/messages',
    docs: 'https://documentation.mailgun.com/docs/mailgun/api-reference/openapi-final/tag/Messages/',
    async send(profile, message) {
      const form = new FormData();
      form.set('from', decorateFrom(profile, message));
      for (const address of message.to) form.append('to', address);
      for (const address of message.cc || []) form.append('cc', address);
      for (const address of message.bcc || []) form.append('bcc', address);
      if (message.replyTo) form.set('h:Reply-To', message.replyTo);
      form.set('subject', message.subject);
      if (message.html) form.set('html', message.html);
      if (message.text) form.set('text', message.text);
      for (const attachment of message.attachments || []) {
        form.append(
          'attachment',
          Buffer.from(attachment.content, 'base64'),
          attachment.filename
        );
      }
      const domain = profile.domain || 'sandbox.invalid';
      const basic = Buffer.from(`api:${profile.apiKey}`).toString('base64');
      const response = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
        method: 'POST',
        headers: { Authorization: `Basic ${basic}` },
        body: form
      });
      return finish(response);
    }
  },
  generic: {
    label: 'Generic JSON API',
    endpoint: '(your endpoint)',
    docs: '',
    async send(profile, message) {
      return request(profile, 'POST', profile.endpoint, {
        from: decorateFrom(profile, message),
        to: message.to,
        subject: message.subject,
        html: message.html || undefined,
        text: message.text || undefined,
        attachments: message.attachments || []
      });
    }
  }
};

function decorateFrom(profile, message) {
  return message.fromName ? `${message.fromName} <${message.from}>` : message.from;
}

function buildContent(message) {
  const content = [];
  if (message.text) content.push({ type: 'text/plain', value: message.text });
  if (message.html) content.push({ type: 'text/html', value: message.html });
  return content.length ? content : [{ type: 'text/plain', value: ' ' }];
}

async function request(profile, method, url, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (profile.authHeader) headers.Authorization = profile.authHeader;
  else if (profile.authScheme) headers.Authorization = `${profile.authScheme} ${profile.apiKey}`;
  else if (profile.apiKey && profile.protocol === 'mailgun') headers.Authorization = `Basic ${profile.apiKey}`;
  else if (profile.apiKey) headers.Authorization = `Bearer ${profile.apiKey}`;
  if (profile.protocol === 'brevo' && profile.apiKey) headers['api-key'] = profile.apiKey;

  const response = await fetch(url, { method, headers, body: JSON.stringify(stripUndefined(body)) });
  return finish(response);
}

function stripUndefined(value) {
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, inner] of Object.entries(value)) {
      if (inner === undefined) continue;
      out[key] = stripUndefined(inner);
    }
    return out;
  }
  return value;
}

async function finish(response) {
  const raw = await response.text();
  let parsed = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  if (!response.ok) {
    const reason = parsed?.message || parsed?.error || parsed?.errors?.[0]?.message || raw.slice(0, 300);
    const error = new Error(`HTTP ${response.status} — ${reason || response.statusText}`);
    error.status = response.status;
    throw error;
  }
  return {
    ok: true,
    id: parsed?.id || parsed?.messageId || null,
    response: typeof parsed === 'object' && parsed !== null ? JSON.stringify(parsed).slice(0, 400) : raw.slice(0, 400)
  };
}

function listProtocols() {
  return Object.entries(PROTOCOLS).map(([id, value]) => ({
    id,
    label: value.label,
    endpoint: value.endpoint,
    docs: value.docs
  }));
}

function getProtocol(id) {
  const protocol = PROTOCOLS[id];
  if (!protocol) throw new Error(`Unknown API protocol: ${id}`);
  return protocol;
}

module.exports = { PROTOCOLS, listProtocols, getProtocol };
