/**
 * Generates the BharatBite PNG icons without any image dependency.
 * Pure Node: an RGBA buffer is rasterised with 3x3 supersampling and written
 * as a PNG using the built-in zlib.
 *
 *   node scripts/gen-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/icons');

const START = [181, 69, 27]; // #b5451b
const END = [243, 201, 141]; // #f3c98d
const PLATE = [253, 251, 247];

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function roundedRectCoverage(x, y, size, radius) {
  const cx = Math.min(x, size - x);
  const cy = Math.min(y, size - y);
  if (cx >= radius || cy >= radius) return 1;
  const dx = radius - cx;
  const dy = radius - cy;
  return Math.hypot(dx, dy) <= radius ? 1 : 0;
}

/** Plate disc with a bite removed from the upper right, plus a centre dot. */
function plateAlpha(x, y, size, scale) {
  const c = size / 2;
  const r = size * 0.27 * scale;
  const d = Math.hypot(x - c, y - c);
  if (d > r) return 0;
  const biteD = Math.hypot(x - (c + r * 0.62), y - (c - r * 0.62));
  if (biteD < r * 0.62) return 0;
  if (d > r * 0.62 && d < r * 0.82) return 1; // ring
  return 0;
}

function render(size, { maskable = false, padding = 0.06 } = {}) {
  const scale = maskable ? 0.78 : 1;
  const radius = maskable ? size / 2 : size * 0.22;
  const buf = Buffer.alloc(size * size * 4);
  const SS = 3;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          const cover = maskable ? 1 : roundedRectCoverage(px, py, size, radius);
          if (cover === 0) continue;
          const t = (px / size) * 0.6 + (py / size) * 0.4;
          const base = mix(START, END, Math.min(1, Math.max(0, t)));
          const pa = plateAlpha(px, py, size, scale);
          const colour = pa > 0 ? mix(base, PLATE, pa) : base;
          r += colour[0];
          g += colour[1];
          b += colour[2];
          a += 255;
        }
      }
      const samples = SS * SS;
      const idx = (y * size + x) * 4;
      const alpha = a / samples;
      if (alpha < 0.5) {
        buf[idx] = 0;
        buf[idx + 1] = 0;
        buf[idx + 2] = 0;
        buf[idx + 3] = 0;
      } else {
        buf[idx] = Math.round(r / (alpha / 255 || 1) / samples);
        buf[idx + 1] = Math.round(g / (alpha / 255 || 1) / samples);
        buf[idx + 2] = Math.round(b / (alpha / 255 || 1) / samples);
        buf[idx + 3] = Math.round(alpha);
      }
    }
  }

  void padding;
  return buf;
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crcBuf]);
}

function toPng(rgba, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT, { recursive: true });

const targets = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['maskable-512.png', 512, { maskable: true }],
  ['apple-touch-icon.png', 180, {}],
];

for (const [name, size, options] of targets) {
  const png = toPng(render(size, options), size);
  writeFileSync(resolve(OUT, name), png);
  console.log(`${name} ${size}×${size} ${(png.length / 1024).toFixed(1)} kB`);
}
