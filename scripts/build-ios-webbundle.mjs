import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const distDir = resolve(rootDir, 'dist');
const iosWebBundleDir = resolve(rootDir, 'ios/InkVaultApp/WebBundle');

if (!existsSync(distDir)) {
  console.error('Error: dist/ does not exist. Run `npm run build` first.');
  process.exit(1);
}

rmSync(iosWebBundleDir, { recursive: true, force: true });
mkdirSync(iosWebBundleDir, { recursive: true });
cpSync(distDir, iosWebBundleDir, { recursive: true });

/**
 * Generates an App Store compliant opaque 24-bit RGB PNG (zero alpha channel!)
 * featuring INKVAULT's bound obsidian monograph book, cobalt architectural spine,
 * warm cream paper inset, and fountain nib emblem.
 */
function generateOpaquePngIcon(size) {
  // PNG Color Type 2 = Truecolor RGB (no alpha channel, required by App Store Connect)
  const stride = 1 + size * 3;
  const raw = Buffer.alloc(stride * size);

  for (let y = 0; y < size; y++) {
    const rowOffset = y * stride;
    raw[rowOffset] = 0; // filter type None
    const ny = y / size;

    for (let x = 0; x < size; x++) {
      const nx = x / size;
      // Rich dark architectural slate background
      let r = Math.round(18 + ny * 8);
      let g = Math.round(21 + ny * 10);
      let b = Math.round(28 + ny * 14);

      // Tactile Notebook silhouette centered in [0.21..0.79, 0.14..0.86]
      if (nx >= 0.21 && nx <= 0.79 && ny >= 0.14 && ny <= 0.86) {
        if (nx <= 0.295) {
          // Royal Cobalt Bookcloth Spine (#2156D8)
          r = 33;
          g = 86;
          b = 216;
        } else if (nx <= 0.305) {
          // Spine Hinge Groove
          r = 16;
          g = 42;
          b = 112;
        } else if (nx >= 0.768) {
          // Stacked Cream Paper Fore-Edge
          r = 236;
          g = 232;
          b = 223;
        } else {
          // Warm Archival Cream Sheet (#FAF7F0)
          r = 250;
          g = 247;
          b = 240;

          // Subtle horizontal ruled paper lines
          const relY = (ny - 0.26) / 0.5;
          if (relY >= 0 && relY <= 1 && nx >= 0.36 && nx <= 0.71) {
            const lineMod = (relY * 6) % 1;
            if (lineMod < 0.035) {
              r = 214;
              g = 211;
              b = 202;
            }
          }

          // Expressive ink S-stroke across the sheet
          const curveCenterY = 0.52 - 0.11 * Math.sin(((nx - 0.36) / 0.35) * Math.PI * 1.6);
          if (nx >= 0.37 && nx <= 0.7 && Math.abs(ny - curveCenterY) < 0.016) {
            r = 24;
            g = 27;
            b = 34;
          }
        }
      }

      const px = rowOffset + 1 + x * 3;
      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
    }
  }

  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length, 0);
    const crcInput = Buffer.concat([typeBuf, data]);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(crcInput), 0);
    return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 2; // Color type 2 = RGB (opaque, no alpha!)
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

const icon1024Path = resolve(
  rootDir,
  'ios/InkVaultApp/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png'
);
mkdirSync(dirname(icon1024Path), { recursive: true });
writeFileSync(icon1024Path, generateOpaquePngIcon(1024));

const touchIconPath = resolve(rootDir, 'public/apple-touch-icon.png');
writeFileSync(touchIconPath, generateOpaquePngIcon(180));

console.log('✓ Synced dist/ -> ios/InkVaultApp/WebBundle/');
console.log('✓ Generated opaque 1024x1024 AppIcon-1024.png & 180x180 apple-touch-icon.png');
