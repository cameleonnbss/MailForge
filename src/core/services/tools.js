// language: JavaScript, file: src/core/services/tools.js
// Pure, dependency-free helpers backing the tools catalog.
'use strict';

const crypto = require('crypto');

/* ------------------------------------------------------------------ data -- */

const DATA = {
  fr: {
    first: ['Amelie', 'Bastien', 'Camille', 'Denis', 'Elodie', 'Fabien', 'Gaelle', 'Hugo', 'Ines', 'Julien', 'Karine', 'Lucas', 'Manon', 'Nicolas', 'Ophelie', 'Pierre', 'Quentin', 'Romane', 'Sophie', 'Thomas', 'Ulysse', 'Valerie', 'Wassim', 'Xavier', 'Yasmine', 'Zoe'],
    last: ['Lefevre', 'Moreau', 'Girard', 'Bonnet', 'Dupont', 'Lambert', 'Fontaine', 'Rousseau', 'Vincent', 'Muller', 'Picard', 'Charpentier', 'Barbier', 'Guillot', 'Masson', 'Renard', 'Faure', 'Blanchard', 'Chevalier', 'Perrin'],
    street: ['rue des Lilas', 'avenue Victor Hugo', 'boulevard Saint-Germain', 'chemin des Vignes', 'place du Marche', 'impasse des Peupliers', 'allee des Cedres', 'rue de la Republique', 'quai des Chartrons', 'route de Nantes'],
    city: ['Lyon', 'Marseille', 'Bordeaux', 'Lille', 'Toulouse', 'Nantes', 'Strasbourg', 'Rennes', 'Montpellier', 'Grenoble'],
    company: ['Atelier Nord', 'Groupe Verdier', 'Studio Lanterne', 'Maison Cordier', 'Delta Solutions', 'Foret & Fils', 'Cerise Numerique', 'Bleu Marine Conseil'],
    words: ['signal', 'atelier', 'boussole', 'horizon', 'falaise', 'quai', 'lanterne', 'verrou', 'ardoise', 'trame']
  },
  en: {
    first: ['Amelia', 'Benjamin', 'Chloe', 'Daniel', 'Elena', 'Frank', 'Grace', 'Henry', 'Iris', 'Jack', 'Karen', 'Liam', 'Maya', 'Noah', 'Olivia', 'Peter', 'Quinn', 'Rose', 'Samuel', 'Tara', 'Umar', 'Vera', 'Wesley', 'Ximena', 'Yara', 'Zach'],
    last: ['Bennett', 'Carter', 'Doyle', 'Ellis', 'Fisher', 'Grant', 'Hayes', 'Irwin', 'Jensen', 'Keller', 'Lombard', 'Mercer', 'Nolan', 'Ortega', 'Parker', 'Quinn', 'Reeves', 'Sutton', 'Thornton', 'Underwood'],
    street: ['Maple Avenue', 'Birch Lane', 'Harbor Road', 'Cedar Street', 'Sycamore Drive', 'Kingsway', 'Old Mill Road', 'Lakeview Terrace', 'Foundry Street', 'Willow Court'],
    city: ['Austin', 'Portland', 'Denver', 'Boston', 'Seattle', 'Chicago', 'Nashville', 'Phoenix', 'Raleigh', 'Madison'],
    company: ['Northline Studio', 'Harbor Works', 'Ironclad Labs', 'Bluebird Digital', 'Quarry & Co', 'Lantern Group', 'Fieldstone Systems', 'Riverbend Supply'],
    words: ['signal', 'workshop', 'compass', 'harbor', 'cliffside', 'pier', 'lantern', 'latch', 'slate', 'frame']
  }
};

function pick(list, random = Math.random) {
  return list[Math.floor(random() * list.length)];
}

function digits(count, random = Math.random) {
  let out = '';
  for (let i = 0; i < count; i += 1) out += Math.floor(random() * 10);
  return out;
}

function streetNumber(random = Math.random) {
  return 1 + Math.floor(random() * 240);
}

function slug(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '');
}

function fakePerson(locale = 'fr', random = Math.random) {
  const table = DATA[locale] || DATA.fr;
  const first = pick(table.first, random);
  const last = pick(table.last, random);
  const emailDomain = pick(['example.com', 'mail.test', 'demo.invalid', `${slug(last)}.example`], random);
  return {
    firstName: first,
    lastName: last,
    fullName: `${first} ${last}`,
    email: `${slug(first)}.${slug(last)}@${emailDomain}`,
    phone: locale === 'fr' ? `0${6 + Math.floor(random() * 2)} ${digits(2, random)} ${digits(2, random)} ${digits(2, random)} ${digits(2, random)}` : `+1 (${digits(3, random)}) ${digits(3, random)}-${digits(4, random)}`,
    address: `${streetNumber(random)} ${pick(table.street, random)}, ${digits(5, random)} ${pick(table.city, random)}`,
    city: pick(table.city, random),
    company: pick(table.company, random),
    jobTitle: pick(['Responsable achats', 'Chef de projet', 'Analyste', 'Directeur technique', 'Consultante', 'Developpeur senior', 'Product owner', 'Comptable'], random),
    iban: `FR76 ${digits(4, random)} ${digits(4, random)} ${digits(4, random)} ${digits(4, random)} ${digits(4, random)} ${digits(2, random)}`,
    birthDate: `${1940 + Math.floor(random() * 60)}-${String(1 + Math.floor(random() * 12)).padStart(2, '0')}-${String(1 + Math.floor(random() * 28)).padStart(2, '0')}`,
    username: `${slug(first)}${digits(3, random)}`
  };
}

function fakeDataset(locale, count, kind = 'person') {
  const total = Math.min(Math.max(Number(count) || 1, 1), 500);
  const rows = [];
  for (let i = 0; i < total; i += 1) {
    if (kind === 'person') rows.push(fakePerson(locale));
    else if (kind === 'email') rows.push({ email: fakePerson(locale).email, fullName: fakePerson(locale).fullName });
    else rows.push(fakePerson(locale));
  }
  return rows;
}

/* --------------------------------------------------------------- values -- */

function password({ length = 20, upper = true, lower = true, numbers = true, symbols = true, excludeAmbiguous = true } = {}) {
  let alphabet = '';
  if (lower) alphabet += 'abcdefghijklmnopqrstuvwxyz';
  if (upper) alphabet += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (numbers) alphabet += '0123456789';
  if (symbols) alphabet += '!@#$%^&*()-_=+[]{};:,.?/';
  if (!alphabet) alphabet = 'abcdefghijklmnopqrstuvwxyz';
  if (excludeAmbiguous) alphabet = alphabet.replace(/[Il1O0o]/g, '');
  const size = Math.min(Math.max(Number(length) || 16, 4), 256);
  const bytes = crypto.randomBytes(size * 2);
  let out = '';
  for (let i = 0; out.length < size; i += 1) {
    const byte = bytes[i % bytes.length];
    if (byte > 255 - (256 % alphabet.length)) continue;
    out += alphabet[byte % alphabet.length];
  }
  const strength = estimateStrength(out);
  return { password: out, entropyBits: Math.round(size * Math.log2(alphabet.length)), strength };
}

function estimateStrength(value) {
  let pool = 0;
  if (/[a-z]/.test(value)) pool += 26;
  if (/[A-Z]/.test(value)) pool += 26;
  if (/[0-9]/.test(value)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(value)) pool += 28;
  const bits = value.length * Math.log2(pool || 1);
  if (bits < 45) return { label: 'faible', score: 1, bits: Math.round(bits) };
  if (bits < 70) return { label: 'moyen', score: 2, bits: Math.round(bits) };
  if (bits < 100) return { label: 'solide', score: 3, bits: Math.round(bits) };
  return { label: 'excellent', score: 4, bits: Math.round(bits) };
}

function passphrase(words = 4, separator = '-', locale = 'fr') {
  const table = (DATA[locale] || DATA.fr).words;
  const chosen = [];
  const bytes = crypto.randomBytes(words * 4);
  for (let i = 0; i < words; i += 1) {
    const value = bytes.readUInt32BE((i * 4) % (bytes.length - 4));
    chosen.push(table[value % table.length]);
  }
  return { password: chosen.join(separator) + digits(3), words: chosen };
}

function uuid({ format = 'v4', count = 1 } = {}) {
  const total = Math.min(Math.max(Number(count) || 1, 1), 200);
  const out = [];
  for (let i = 0; i < total; i += 1) {
    if (format === 'nil') out.push('00000000-0000-0000-0000-000000000000');
    else if (format === 'compact') out.push(crypto.randomUUID().replace(/-/g, ''));
    else if (format === 'upper') out.push(crypto.randomUUID().toUpperCase());
    else out.push(crypto.randomUUID());
  }
  return out;
}

function hash(text, algorithms = ['sha256', 'sha1', 'md5', 'sha512']) {
  const payload = Buffer.from(String(text ?? ''), 'utf8');
  return algorithms.reduce((acc, algorithm) => {
    acc[algorithm] = crypto.createHash(algorithm).update(payload).digest('hex');
    return acc;
  }, {});
}

function ulid(random = Math.random) {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let time = Date.now();
  let stamp = '';
  for (let i = 0; i < 10; i += 1) {
    stamp = alphabet[time % 32] + stamp;
    time = Math.floor(time / 32);
  }
  let tail = '';
  const bytes = crypto.randomBytes(16);
  for (let i = 0; i < 16; i += 1) tail += alphabet[bytes[i] % 32];
  return stamp + tail;
}

/* ---------------------------------------------------------- encode/decode -- */

function base64({ text = '', mode = 'encode', urlSafe = false } = {}) {
  if (mode === 'encode') {
    const out = Buffer.from(String(text), 'utf8').toString('base64');
    return urlSafe ? out.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : out;
  }
  let payload = String(text).trim().replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
  while (payload.length % 4) payload += '=';
  return Buffer.from(payload, 'base64').toString('utf8');
}

function urlCode({ text = '', mode = 'encode' } = {}) {
  return mode === 'encode' ? encodeURIComponent(text) : decodeURIComponent(text);
}

/* ---------------------------------------------------------------- json -- */

function jsonTool({ text = '', mode = 'pretty', indent = 2 } = {}) {
  if (!String(text).trim()) return { ok: true, output: '', stats: null };
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const match = /position (\d+)/.exec(error.message);
    return { ok: false, error: error.message, position: match ? Number(match[1]) : null };
  }
  const output =
    mode === 'minify' ? JSON.stringify(parsed) : JSON.stringify(parsed, null, Number(indent) || 2);
  return {
    ok: true,
    output,
    stats: {
      bytes: Buffer.byteLength(output, 'utf8'),
      keys: countKeys(parsed),
      depth: depthOf(parsed),
      lines: output.split('\n').length
    }
  };
}

function countKeys(value) {
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + countKeys(item), 0);
  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((sum, [, inner]) => sum + 1 + countKeys(inner), 0);
  }
  return 0;
}

function depthOf(value) {
  if (Array.isArray(value)) return 1 + Math.max(0, ...value.map(depthOf));
  if (value && typeof value === 'object') return 1 + Math.max(0, ...Object.values(value).map(depthOf));
  return 0;
}

function toCsv(rows) {
  if (!rows?.length) return '';
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const escape = (value) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.join(';'), ...rows.map((row) => headers.map((header) => escape(row[header])).join(';'))].join('\n');
}

const LOREM = ('lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et ' +
  'dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo ' +
  'consequat duis aute irure reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur excepteur sint ' +
  'occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum').split(' ');

function loremText({ paragraphs = 3, sentencesPerParagraph = 4, startWithLorem = true } = {}) {
  const paragraphCount = Math.min(Math.max(Number(paragraphs) || 1, 1), 40);
  const sentenceCount = Math.min(Math.max(Number(sentencesPerParagraph) || 1, 1), 20);
  const out = [];
  for (let p = 0; p < paragraphCount; p += 1) {
    const sentences = [];
    for (let s = 0; s < sentenceCount; s += 1) {
      const wordCount = 8 + Math.floor(Math.random() * 12);
      const words = [];
      for (let w = 0; w < wordCount; w += 1) words.push(LOREM[Math.floor(Math.random() * LOREM.length)]);
      if (p === 0 && s === 0) {
        words.splice(0, 5, 'Lorem', 'ipsum', 'dolor', 'sit', 'amet');
      }
      sentences.push(words.join(' ').replace(/^./, (c) => c.toUpperCase()) + '.');
    }
    out.push(sentences.join(' '));
  }
  return out.join('\n\n');
}

function loremHtml(options = {}) {
  return loremText(options)
    .split('\n\n')
    .map((paragraph) => `<p>${paragraph}</p>`)
    .join('\n');
}

/* ---------------------------------------------------------- converters -- */

function timestampConvert({ value = '', mode = 'toDate', unit = 'auto' } = {}) {
  if (mode === 'toDate') {
    let number = Number(String(value).trim());
    if (!Number.isFinite(number)) return { ok: false, error: 'Valeur numerique attendue.' };
    const asSeconds = unit === 's' || (unit === 'auto' && String(value).length <= 11);
    if (asSeconds) number *= 1000;
    const date = new Date(number);
    if (Number.isNaN(date.getTime())) return { ok: false, error: 'Date hors limites.' };
    return {
      ok: true,
      iso: date.toISOString(),
      local: date.toString(),
      utc: date.toUTCString(),
      relative: relativeTime(date)
    };
  }
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return { ok: false, error: 'Date illisible.' };
  return {
    ok: true,
    seconds: Math.floor(date.getTime() / 1000),
    milliseconds: date.getTime(),
    iso: date.toISOString()
  };
}

function relativeTime(date) {
  const diff = Date.now() - date.getTime();
  const units = [
    ['an', 31536000000],
    ['mois', 2592000000],
    ['jour', 86400000],
    ['heure', 3600000],
    ['minute', 60000],
    ['seconde', 1000]
  ];
  for (const [label, ms] of units) {
    if (Math.abs(diff) >= ms) {
      const count = Math.round(diff / ms);
      return `${count} ${label}${Math.abs(count) > 1 ? 's' : ''} ${count > 0 ? 'avant' : 'apres'}`;
    }
  }
  return "a l'instant";
}

function colorConvert({ value = '' } = {}) {
  const text = String(value).trim();
  const hexMatch = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const [h, s, l] = rgbToHsl(r, g, b);
    return { ok: true, hex: `#${hex.toLowerCase()}`, rgb: `rgb(${r}, ${g}, ${b})`, hsl: `hsl(${h}, ${s}%, ${l}%)` };
  }
  const rgbMatch = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(text);
  if (rgbMatch) {
    const [r, g, b] = rgbMatch.slice(1).map(Number);
    const hex = [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
    const [h, s, l] = rgbToHsl(r, g, b);
    return { ok: true, hex: `#${hex}`, rgb: `rgb(${r}, ${g}, ${b})`, hsl: `hsl(${h}, ${s}%, ${l}%)` };
  }
  return { ok: false, error: 'Format attendu: #3b82f6 ou rgb(59,130,246).' };
}

function rgbToHsl(r, g, b) {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6;
    else if (max === gg) h = ((bb - rr) / d + 2) / 6;
    else h = ((rr - gg) / d + 4) / 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function caseConvert({ text = '', mode = 'upper' } = {}) {
  const value = String(text);
  const modes = {
    upper: () => value.toUpperCase(),
    lower: () => value.toLowerCase(),
    title: () =>
      value.toLowerCase().replace(/(^|\s|[-_])([\p{L}])/gu, (m, sep, char) => sep + char.toUpperCase()),
    sentence: () => value.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, (m) => m.toUpperCase()),
    slug: () => slug(value).replace(/\./g, '-'),
    snake: () => slug(value).replace(/\./g, '_'),
    camel: () =>
      slug(value)
        .split('.')
        .map((part, index) => (index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
        .join(''),
    reverse: () => value.split('').reverse().join('')
  };
  return { ok: true, output: (modes[mode] || modes.upper)() };
}

function diffText({ left = '', right = '' } = {}) {
  const a = String(left).split('\n');
  const b = String(right).split('\n');
  const max = Math.max(a.length, b.length);
  const rows = [];
  let changed = 0;
  for (let i = 0; i < max; i += 1) {
    const av = a[i] ?? '';
    const bv = b[i] ?? '';
    const state = av === bv ? 'same' : 'diff';
    if (state === 'diff') changed += 1;
    rows.push({ line: i + 1, left: av, right: bv, state });
  }
  return { rows, changed, total: max };
}

/* --------------------------------------------------------------- export -- */

function statsFor(text) {
  const value = String(text ?? '');
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  return {
    characters: value.length,
    charactersNoSpaces: value.replace(/\s/g, '').length,
    words,
    lines: value ? value.split('\n').length : 0,
    bytes: Buffer.byteLength(value, 'utf8'),
    readMinutes: Math.max(1, Math.round(words / 200))
  };
}

const CATALOG = [
  { id: 'fake-data', label: 'Donnees fictives', icon: 'user', group: 'Generateurs', description: 'Identites, adresses, IBAN, societes — export CSV/JSON.' },
  { id: 'password', label: 'Mots de passe', icon: 'key', group: 'Generateurs', description: 'Crypto-aleatoire avec entropie calculee, ou phrase de passe.' },
  { id: 'uuid', label: 'UUID / ULID', icon: 'hash', group: 'Generateurs', description: 'v4, compact, majuscules, nil, ULID triable.' },
  { id: 'lorem', label: 'Texte de test', icon: 'paragraph', group: 'Generateurs', description: 'Lorem ipsum en paragraphes ou HTML pret a coller.' },
  { id: 'base64', label: 'Base64', icon: 'code', group: 'Encodeurs', description: 'Encode/decode, variante URL-safe.' },
  { id: 'urlencode', label: 'URL encode', icon: 'link', group: 'Encodeurs', description: 'encodeURIComponent / decodeURIComponent.' },
  { id: 'hash', label: 'Hachage', icon: 'fingerprint', group: 'Encodeurs', description: 'SHA-256/512, SHA-1, MD5 en un passage.' },
  { id: 'case', label: 'Casse & slug', icon: 'type', group: 'Encodeurs', description: 'MAJ, minuscules, Title, slug, snake_case, camelCase.' },
  { id: 'json', label: 'JSON', icon: 'brackets', group: 'Data', description: 'Formatage, minification, statistiques, erreurs localisees.' },
  { id: 'timestamp', label: 'Horodatage', icon: 'clock', group: 'Data', description: 'Unix <-> ISO/UTC, duree relative.' },
  { id: 'color', label: 'Couleurs', icon: 'palette', group: 'Data', description: 'HEX <-> RGB <-> HSL.' },
  { id: 'diff', label: 'Comparateur', icon: 'diff', group: 'Data', description: 'Diff ligne par ligne, comptage des changements.' },
  { id: 'headers', label: 'Analyseur de headers', icon: 'mail', group: 'E-mail', description: 'Chaine Received, delais, SPF/DKIM/DMARC, incoherences.' },
  { id: 'templates', label: 'Modeles e-mail', icon: 'template', group: 'E-mail', description: 'Modeles reutilisables avec variables {{nom}}.' },
  { id: 'snippets', label: 'Snippets', icon: 'clipboard', group: 'E-mail', description: 'Blocs de texte courts, insertion en un clic.' },
  { id: 'stats', label: 'Statistiques texte', icon: 'chart', group: 'Data', description: 'Caracteres, mots, lignes, octets, temps de lecture.' }
];

module.exports = {
  fakePerson,
  fakeDataset,
  password,
  passphrase,
  uuid,
  ulid,
  hash,
  base64,
  urlCode,
  jsonTool,
  toCsv,
  loremText,
  loremHtml,
  timestampConvert,
  colorConvert,
  caseConvert,
  diffText,
  statsFor,
  estimateStrength,
  CATALOG
};
