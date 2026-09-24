// language: JavaScript, file: scripts/make-icons.js
// Generates build/icon.png and build/icon.ico with no image dependency: the
// pixels are rasterised here (signed-distance shapes), encoded as PNG via zlib,
// and packed into an ICO container. Run: npm run icons
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT_DIR = path.join(__dirname, '..', 'build');

/* --------------------------------------------------------------- raster -- */

function createCanvas(size) {
  const pixels = new Float64Array(size * size * 4);
  return { size, pixels };
}

function blend(canvas, x, y, r, g, b, a) {
  const offset = (y * canvas.size + x) * 4;
  const src = canvas.pixels;
  const dstA = src[offset + 3];
  const outA = a + dstA * (1 - a);
  if (outA <= 0) return;
  src[offset] = (r * a + src[offset] * dstA * (1 - a)) / outA;
  src[offset + 1] = (g * a + src[offset + 1] * dstA * (1 - a)) / outA;
  src[offset + 2] = (b * a + src[offset + 2] * dstA * (1 - a)) / outA;
  src[offset + 3] = outA;
}

/** Signed distance to a rounded rectangle (negative = inside). */
function sdRoundRect(px, py, cx, cy, halfW, halfH, radius) {
  const dx = Math.abs(px - cx) - (halfW - radius);
  const dy = Math.abs(py - cy) - (halfH - radius);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  return outside + Math.min(Math.max(dx, dy), 0) - radius;
}

function fillShape(canvas, test, color) {
  const { size } = canvas;
  const alpha = color[3] === undefined ? 1 : color[3];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const coverage = test(x + 0.5, y + 0.5);
      if (coverage <= 0) continue;
      blend(canvas, x, y, color[0], color[1], color[2], Math.min(1, coverage) * alpha);
    }
  }
}

/** Anti-aliased coverage helper from a signed distance. */
function coverageFromDistance(distance, feather = 1) {
  return Math.max(0, Math.min(1, 0.5 - distance / feather));
}

function hex(value) {
  const clean = value.replace('#', '');
  return [0, 2, 4].map((index) => parseInt(clean.slice(index, index + 2), 16));
}

/** The MailForge mark: a sealed envelope with a stitched flap and a bolt. */
function drawMark(canvas, { inset = 0 } = {}) {
  const size = canvas.size;
  const s = size / 256;
  const margin = size * 0.085 + inset;

  // rounded plate: alpha from the rounded-rect distance, then a vertical gradient
  const gradTop = hex('#8b9bff');
  const gradBottom = hex('#6d5df0');
  fillShape(
    canvas,
    (px, py) => coverageFromDistance(sdRoundRect(px, py, size / 2, size / 2, size / 2 - margin, size / 2 - margin, 52 * s), 1.6),
    [gradTop[0], gradTop[1], gradTop[2], 1]
  );

  // paint plate colours per row so the gradient stays smooth
  for (let y = 0; y < size; y += 1) {
    const t = y / size;
    const colour = [
      gradTop[0] + (gradBottom[0] - gradTop[0]) * t,
      gradTop[1] + (gradBottom[1] - gradTop[1]) * t,
      gradTop[2] + (gradBottom[2] - gradTop[2]) * t
    ];
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      if (canvas.pixels[offset + 3] <= 0) continue;
      canvas.pixels[offset] = colour[0];
      canvas.pixels[offset + 1] = colour[1];
      canvas.pixels[offset + 2] = colour[2];
    }
  }

  // envelope body
  const bodyW = 148 * s;
  const bodyH = 104 * s;
  const cx = size / 2;
  const cy = size * 0.545;
  fillShape(
    canvas,
    (px, py) => {
      const outer = coverageFromDistance(sdRoundRect(px, py, cx, cy, bodyW / 2, bodyH / 2, 13 * s), 1.5);
      const inner = coverageFromDistance(sdRoundRect(px, py, cx, cy, bodyW / 2 - 7 * s, bodyH / 2 - 7 * s, 9 * s), 1.5);
      return Math.max(0, outer - inner);
    },
    [255, 255, 255, 0.96]
  );

  // flap: two strokes forming a V, clipped to the envelope top
  const flapTop = cy - bodyH / 2 + 9 * s;
  const flapDepth = cy + 16 * s;
  fillShape(
    canvas,
    (px, py) => {
      const halfWidth = (148 * s) / 2;
      const t = Math.max(0, Math.min(1, (py - flapTop) / (flapDepth - flapTop)));
      const edge = halfWidth * (1 - t);
      const distance = Math.abs(Math.abs(px - cx) - edge);
      if (py < flapTop - 2 || py > flapDepth) return 0;
      return coverageFromDistance(distance - 4.4 * s, 1.5);
    },
    [255, 255, 255, 0.92]
  );

  // bolt: a signal leaving the envelope
  const bolt = [
    [0.615, 0.28],
    [0.5, 0.55],
    [0.58, 0.55],
    [0.545, 0.78],
    [0.675, 0.49],
    [0.592, 0.49]
  ];
  fillShape(
    canvas,
    (px, py) => {
      const nx = px / size;
      const ny = py / size;
      let inside = false;
      for (let i = 0, j = bolt.length - 1; i < bolt.length; j = i, i += 1) {
        const [xi, yi] = bolt[i];
        const [xj, yj] = bolt[j];
        if (yi > ny !== yj > ny && nx < ((xj - xi) * (ny - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (!inside) return 0;
      return 1;
    },
    [24, 27, 46, 1]
  );
}

/* ------------------------------------------------------------ encoding -- */

function crc32(buffer) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) crc = (crc >>> 8) ^ table[(crc ^ buffer[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(canvas) {
  const { size } = canvas;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let cursor = 0;
  for (let y = 0; y < size; y += 1) {
    raw[cursor++] = 0; // filter: none
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      raw[cursor++] = Math.round(canvas.pixels[offset]);
      raw[cursor++] = Math.round(canvas.pixels[offset + 1]);
      raw[cursor++] = Math.round(canvas.pixels[offset + 2]);
      raw[cursor++] = Math.round(canvas.pixels[offset + 3] * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolour + alpha
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function encodeIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  let offset = 6 + entries.length * 16;
  const directory = [];
  const blobs = [];
  for (const entry of entries) {
    const dir = Buffer.alloc(16);
    dir[0] = entry.size >= 256 ? 0 : entry.size;
    dir[1] = entry.size >= 256 ? 0 : entry.size;
    dir[2] = 0;
    dir[3] = 0;
    dir.writeUInt16LE(1, 4);
    dir.writeUInt16LE(32, 6);
    dir.writeUInt32LE(entry.png.length, 8);
    dir.writeUInt32LE(offset, 12);
    directory.push(dir);
    blobs.push(entry.png);
    offset += entry.png.length;
  }
  return Buffer.concat([header, ...directory, ...blobs]);
}

/* ----------------------------------------------------------------- main -- */

function render(size) {
  const canvas = createCanvas(size);
  drawMark(canvas, { inset: size * 0.02 });
  return canvas;
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngs = sizes.map((size) => ({ size, png: encodePng(render(size)) }));

  fs.writeFileSync(path.join(OUT_DIR, 'icon.png'), pngs.find((entry) => entry.size === 256).png);
  fs.writeFileSync(path.join(OUT_DIR, 'icon.ico'), encodeIco(pngs));
  fs.writeFileSync(path.join(OUT_DIR, 'icon-512.png'), encodePng(render(512)));

  // a tiny SVG twin for documentation and the web preview
  const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#8b9bff"/><stop offset="1" stop-color="#6d5df0"/>
  </linearGradient></defs>
  <rect x="22" y="22" width="212" height="212" rx="52" fill="url(#g)"/>
  <rect x="54" y="88" width="148" height="104" rx="13" fill="none" stroke="#fff" stroke-width="7" stroke-opacity=".95"/>
  <path d="M58 96 L128 148 L198 96" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-opacity=".92"/>
  <path d="M157 72 L128 141 L148 141 L139 200 L173 125 L151 125 Z" fill="#181b2e"/>
</svg>
`;
  fs.writeFileSync(path.join(OUT_DIR, 'icon.svg'), svgIcon);

  const listing = [...pngs.map((entry) => `${entry.size}px`), '512px', 'icon.svg'].join(', ');
  process.stdout.write(`Icons written to build/ (${listing})\n`);
}

if (require.main === module) main();

module.exports = { render, encodePng, encodeIco, drawMark, createCanvas };
