// language: JavaScript, file: src/core/services/run-tool.js
// Single dispatcher for the tools catalog. Shared by IPC and the CLI so a tool
// behaves identically in both.
'use strict';

const t = require('./tools');
const headers = require('./headers');

function runTool(id, params = {}) {
  const map = {
    'fake-data': () => {
      const rows = t.fakeDataset(params.locale, params.count, params.kind);
      return { rows, csv: t.toCsv(rows), json: JSON.stringify(rows, null, 2), count: rows.length };
    },
    password: () =>
      params.mode === 'passphrase'
        ? t.passphrase(Number(params.words) || 4, params.separator || '-', params.locale)
        : t.password({
            length: Number(params.length) || 20,
            upper: params.upper !== 'false' && params.upper !== false,
            lower: params.lower !== 'false' && params.lower !== false,
            numbers: params.numbers !== 'false' && params.numbers !== false,
            symbols: params.symbols !== 'false' && params.symbols !== false,
            excludeAmbiguous: params.excludeAmbiguous !== 'false' && params.excludeAmbiguous !== false
          }),
    uuid: () => ({
      values: t.uuid({ format: params.format || 'v4', count: Number(params.count) || 1 })
    }),
    lorem: () => {
      const text = t.loremText(params);
      return { text, html: t.loremHtml(params), stats: t.statsFor(text) };
    },
    base64: () => ({ output: t.base64({ text: params.text || '', mode: params.mode || 'encode', urlSafe: Boolean(params.urlSafe) }) }),
    urlencode: () => ({ output: t.urlCode({ text: params.text || '', mode: params.mode || 'encode' }) }),
    hash: () => ({ text: params.text || '', hashes: t.hash(params.text || '') }),
    case: () => t.caseConvert({ text: params.text || '', mode: params.mode || 'upper' }),
    json: () => t.jsonTool({ text: params.text || '', mode: params.mode || 'pretty', indent: params.indent }),
    timestamp: () => t.timestampConvert({ value: params.value || '', mode: params.mode || 'toDate', unit: params.unit || 'auto' }),
    color: () => t.colorConvert({ value: params.value || '' }),
    diff: () => ({ ...t.diffText({ left: params.left || '', right: params.right || '' }) }),
    headers: () => {
      const report = headers.analyse(params.raw || '');
      return { ...report, body: report.ok ? headers.extractBody(params.raw || '').slice(0, 20000) : '' };
    },
    stats: () => t.statsFor(params.text || ''),
    ulid: () => ({ values: Array.from({ length: Math.min(Math.max(Number(params.count) || 1, 1), 200) }, () => t.ulid()) })
  };
  const runner = map[id];
  if (!runner) throw new Error(`Outil inconnu: ${id}`);
  return runner();
}

module.exports = { runTool };
