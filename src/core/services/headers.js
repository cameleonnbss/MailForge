// language: JavaScript, file: src/core/services/headers.js
// Parses a raw RFC 5322 message: unfolded header list, Received chain with hop
// delays, authentication verdicts, and the consistency checks that actually
// explain "why did this land in spam".
'use strict';

const AUTH_PATTERNS = {
  spf: /spf=(\w+)/i,
  dkim: /dkim=(\w+)/i,
  dmarc: /dmarc=(\w+)/i,
  arc: /arc=(\w+)/i
};

function decodeWords(value) {
  if (!value) return '';
  return String(value).replace(/=\?([^?]+)\?([BQ])\?([^?]*)\?=/gi, (match, charset, encoding, payload) => {
    try {
      const buffer =
        encoding.toUpperCase() === 'B'
          ? Buffer.from(payload, 'base64')
          : Buffer.from(payload.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (m, hex) => String.fromCharCode(parseInt(hex, 16))), 'binary');
      if (/utf-8|utf8|ascii/i.test(charset)) return buffer.toString('utf8');
      if (/iso-8859-1|latin1/i.test(charset)) return buffer.toString('latin1');
      if (/windows-1252|cp1252/i.test(charset)) return buffer.toString('latin1');
      return buffer.toString('utf8');
    } catch {
      return match;
    }
  });
}

function splitMessage(raw) {
  const normalised = String(raw || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const boundary = normalised.indexOf('\n\n');
  if (boundary === -1) return { headerBlock: normalised, body: '' };
  return { headerBlock: normalised.slice(0, boundary), body: normalised.slice(boundary + 2) };
}

function parseHeaders(raw) {
  const { headerBlock, body } = splitMessage(raw);
  const unfolded = headerBlock.replace(/\n[ \t]+/g, ' ');
  const headers = [];
  for (const line of unfolded.split('\n')) {
    if (!line.trim()) continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    headers.push({
      name: line.slice(0, colon).trim(),
      value: line.slice(colon + 1).trim()
    });
  }
  return { headers, body };
}

function get(headers, name) {
  const found = headers.find((header) => header.name.toLowerCase() === name.toLowerCase());
  return found ? found.value : '';
}

function getAll(headers, name) {
  return headers.filter((header) => header.name.toLowerCase() === name.toLowerCase()).map((h) => h.value);
}

function parseAddress(value) {
  const decoded = decodeWords(value);
  const angled = decoded.match(/^(.*?)<([^>]+)>/);
  if (angled) {
    return { name: angled[1].trim().replace(/^"|"$/g, ''), address: angled[2].trim().toLowerCase() };
  }
  return { name: '', address: decoded.trim().toLowerCase() };
}

function parseReceived(value) {
  const from = /\bfrom\s+([^\s;]+)/i.exec(value);
  const by = /\bby\s+([^\s;]+)/i.exec(value);
  const withProto = /\bwith\s+([^\s;]+)/i.exec(value);
  const id = /\bid\s+([^\s;]+)/i.exec(value);
  const timestamp = /;\s*([^;]+)$/.exec(value);
  let date = null;
  if (timestamp) {
    const parsed = new Date(timestamp[1].trim());
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  }
  return {
    from: from ? from[1] : '',
    by: by ? by[1] : '',
    protocol: withProto ? withProto[1] : '',
    id: id ? id[1] : '',
    date: date ? date.toISOString() : null,
    raw: value
  };
}

function analyse(raw) {
  const { headers, body } = parseHeaders(raw);
  if (!headers.length) {
    return { ok: false, error: 'Aucun header detecte. Collez le message brut (Ctrl+U dans la plupart des clients).' };
  }

  const receivedChain = getAll(headers, 'Received').map(parseReceived);
  const chronological = receivedChain.slice().reverse();

  const hops = chronological.map((hop, index) => {
    const previous = chronological[index - 1];
    const delayMs = previous?.date && hop.date ? new Date(hop.date) - new Date(previous.date) : null;
    return { ...hop, index: index + 1, delayMs };
  });
  const totalDelay = hops.reduce((sum, hop) => sum + (hop.delayMs || 0), 0);

  const authHeader = getAll(headers, 'Authentication-Results').concat(getAll(headers, 'ARC-Authentication-Results')).join('\n');
  const receivedSpf = get(headers, 'Received-SPF');
  const auth = {};
  for (const [key, pattern] of Object.entries(AUTH_PATTERNS)) {
    const match = pattern.exec(authHeader);
    auth[key] = match ? match[1].toLowerCase() : null;
  }
  if (!auth.spf && receivedSpf) {
    const match = /^(\w+)/.exec(receivedSpf);
    if (match) auth.spf = match[1].toLowerCase();
  }

  const from = parseAddress(get(headers, 'From'));
  const replyTo = get(headers, 'Reply-To') ? parseAddress(get(headers, 'Reply-To')) : null;
  const returnPath = get(headers, 'Return-Path') ? parseAddress(get(headers, 'Return-Path')) : null;
  const subject = decodeWords(get(headers, 'Subject'));

  const contentType = get(headers, 'Content-Type');
  const parts = [];
  if (/multipart/i.test(contentType)) {
    const boundaryMatch = /boundary="?([^";]+)"?/i.exec(contentType);
    if (boundaryMatch) {
      const marker = `--${boundaryMatch[1]}`;
      const chunks = body.split(marker).slice(1, -1);
      for (const chunk of chunks) {
        const typeMatch = /Content-Type:\s*([^\n;]+)/i.exec(chunk);
        const nameMatch = /filename\*?=(?:"|)([^"\n;]+)/i.exec(chunk);
        if (typeMatch || nameMatch) {
          parts.push({
            type: (typeMatch?.[1] || 'unknown').trim(),
            filename: nameMatch?.[1]?.trim() || null,
            size: chunk.length
          });
        }
      }
    }
  }

  const domainOf = (address) => (address.includes('@') ? address.split('@').pop() : '');
  const fromDomain = domainOf(from.address);
  const spfDomain = returnPath ? domainOf(returnPath.address) : '';

  const flags = [];
  const add = (level, title, detail) => flags.push({ level, title, detail });

  if (auth.spf && auth.spf !== 'pass') add('error', 'SPF non valide', `Verdict SPF: ${auth.spf}. Le domaine d'enveloppe n'autorise pas l'IP expeditrice.`);
  else if (auth.spf === 'pass') add('ok', 'SPF valide', "L'IP expeditrice est autorisee par le domaine d'enveloppe.");
  else add('warn', 'SPF absent', "Aucun resultat SPF dans les headers — le serveur receveur n'a pas publie de verdict.");

  if (auth.dkim && auth.dkim !== 'pass') add('warn', 'DKIM non valide', `Verdict DKIM: ${auth.dkim}. La signature ne couvre pas le message tel que recu.`);
  else if (auth.dkim === 'pass') add('ok', 'DKIM valide', 'La signature cryptographique du domaine signataire est correcte.');

  if (auth.dmarc && auth.dmarc !== 'pass') add('error', 'DMARC non valide', `Verdict DMARC: ${auth.dmarc}. Alignement SPF/DKIM insuffisant pour le domaine From.`);
  else if (auth.dmarc === 'pass') add('ok', 'DMARC valide', 'Le message est aligne avec la politique DMARC du domaine From.');
  else add('warn', 'DMARC absent', 'Pas de verdict DMARC dans les headers.');

  if (replyTo && replyTo.address && domainOf(replyTo.address) !== fromDomain) {
    add('warn', 'Reply-To sur un autre domaine', `From ${fromDomain} mais Reply-To ${domainOf(replyTo.address)} — schema typique d'usurpation.`);
  }
  if (returnPath && spfDomain && fromDomain && spfDomain !== fromDomain) {
    add('warn', 'Domaine d\'enveloppe different', `Return-Path ${spfDomain} vs From ${fromDomain}. Legal pour un service d'envoi, suspect sinon.`);
  }
  const spamHeader = get(headers, 'X-Spam-Status') || get(headers, 'X-Spam-Flag') || get(headers, 'X-Spam-Score');
  if (spamHeader) {
    const isSpam = /yes|true/i.test(spamHeader) || /score[=:]\s*([\d.]+)/i.exec(spamHeader)?.slice(1).some((n) => Number(n) >= 5);
    add(isSpam ? 'error' : 'info', 'Filtre local', spamHeader.slice(0, 200));
  }
  const missingDate = !get(headers, 'Date');
  const missingMessageId = !get(headers, 'Message-ID');
  if (missingMessageId) add('warn', 'Message-ID absent', 'Obligatoire en RFC 5322 — souvent ajoute par le serveur, sinon filtre comme anormal.');
  if (missingDate) add('warn', 'Date absente', 'Un message sans Date est frequemment penalise.');

  const receivedCount = receivedChain.length;
  if (receivedCount === 0) add('info', 'Aucun header Received', "C'est un brouillon local ou un export depouille, pas un message livre.");
  if (totalDelay > 120000) add('warn', 'Delai de livraison eleve', `${Math.round(totalDelay / 1000)} s cumulees sur ${hops.length} sauts — greylisting ou file d'attente.`);

  return {
    ok: true,
    counts: {
      headers: headers.length,
      received: receivedCount,
      parts: parts.length,
      bodyBytes: Buffer.byteLength(body, 'utf8')
    },
    headers: headers.map((header) => ({ ...header, decoded: decodeWords(header.value) })),
    duplicated: Object.entries(
      headers.reduce((acc, header) => {
        const key = header.name.toLowerCase();
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {})
    )
      .filter(([, count]) => count > 1)
      .map(([name, count]) => ({ name, count })),
    received: hops,
    totalDelayMs: totalDelay,
    auth,
    from,
    replyTo,
    returnPath,
    subject,
    date: get(headers, 'Date'),
    messageId: get(headers, 'Message-ID'),
    xMailer: get(headers, 'X-Mailer') || get(headers, 'User-Agent'),
    listUnsubscribe: get(headers, 'List-Unsubscribe'),
    contentType,
    parts,
    flags
  };
}

function extractBody(raw) {
  const { headers, body } = parseHeaders(raw);
  const contentType = get(headers, 'Content-Type');
  if (!/multipart/i.test(contentType)) return body;
  const boundaryMatch = /boundary="?([^";]+)"?/i.exec(contentType);
  if (!boundaryMatch) return body;
  const chunks = body.split(`--${boundaryMatch[1]}`);
  const textPart = chunks.find((chunk) => /Content-Type:\s*text\/plain/i.test(chunk));
  const htmlPart = chunks.find((chunk) => /Content-Type:\s*text\/html/i.test(chunk));
  const chosen = textPart || htmlPart || '';
  const split = chosen.indexOf('\n\n');
  return split === -1 ? chosen : chosen.slice(split + 2);
}

module.exports = { analyse, parseHeaders, decodeWords, extractBody };
