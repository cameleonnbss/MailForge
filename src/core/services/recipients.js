// language: JavaScript, file: src/core/services/recipients.js
// Recipient-list parsing for the bulk sender. Accepts newline lists, CSV or
// semicolon-separated files, with or without a header row.
'use strict';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

function splitLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseRecipientList(text) {
  const lines = splitLines(text);
  if (!lines.length) return { recipients: [], invalid: 0, duplicates: 0 };
  const delimiter = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
  const first = lines[0].trim();
  const headerLike = /@|mail|nom|name|email|courriel/i.test(first) && !EMAIL_RE.test(first.replace(/^"|"$/g, ''));
  const headers = headerLike
    ? first.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, '').toLowerCase())
    : null;

  const body = headerLike ? lines.slice(1) : lines;
  const rows = [];
  let invalid = 0;

  for (const line of body) {
    const cells = line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, ''));
    const row = {};
    if (headers) cells.forEach((cell, index) => { row[headers[index] || `col${index + 1}`] = cell; });
    const email =
      (headers && (row.email || row.mail || row.courriel || row.adresse)) ||
      cells.find((cell) => EMAIL_RE.test(cell));
    if (!email || !EMAIL_RE.test(email)) {
      invalid += 1;
      continue;
    }
    const vars = {};
    if (headers) {
      for (const key of Object.keys(row)) {
        if (['email', 'mail', 'courriel', 'adresse'].includes(key)) continue;
        if (row[key]) vars[key] = row[key];
      }
      if (!vars.nom && row.nom) vars.nom = row.nom;
    } else {
      const extras = cells.filter((cell) => cell !== email);
      if (extras[0]) vars.nom = extras[0];
    }
    rows.push({ email, ...vars });
  }

  const seen = new Set();
  const recipients = [];
  let duplicates = 0;
  for (const row of rows) {
    const key = row.email.toLowerCase();
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    recipients.push(row);
  }
  return { recipients, invalid, duplicates };
}

module.exports = { parseRecipientList, EMAIL_RE };
