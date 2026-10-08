import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.resolve(dirname, '../public/icons');
mkdirSync(iconsDir, { recursive: true });

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let crc = -1;
  for (const byte of buf) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function inRoundedRect(x, y, s, radius) {
  const r = radius * s;
  const minX = r;
  const maxX = s - r;
  const minY = r;
  const maxY = s - r;
  if (x < minX || x > maxX || y < minY || y > maxY) {
    const cx = x < minX ? minX : x > maxX ? maxX : x;
    const cy = y < minY ? minY : y > maxY ? maxY : y;
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= r * r;
  }
  return true;
}

function makeIcon(size, { maskable = false, round = true } = {}) {
  const s = size;
  const px = Buffer.alloc(s * s * 4);
  const radius = round ? s * 0.22 : 0;

  const contentScale = maskable ? 0.68 : 1;
  const cx = s / 2;
  const cy = s / 2;
  const stemW = 0.05 * s * contentScale;
  const stemTop = cy - 0.06 * s * contentScale;
  const stemBottom = cy + 0.18 * s * contentScale;
  const stemHalf = Math.max(1, stemW / 2);

  const leaves = [
    [cx - 0.16 * s * contentScale, cy - 0.02 * s * contentScale, 0.15 * s * contentScale],
    [cx + 0.16 * s * contentScale, cy - 0.12 * s * contentScale, 0.15 * s * contentScale],
    [cx, cy - 0.22 * s * contentScale, 0.14 * s * contentScale],
    [cx + 0.04 * s * contentScale, cy + 0.06 * s * contentScale, 0.1 * s * contentScale],
  ];

  for (let y = 0; y < s; y += 1) {
    for (let x = 0; x < s; x += 1) {
      const u = x + 0.5;
      const v = y + 0.5;
      const inside = maskable ? true : inRoundedRect(u, v, s, radius);

      if (!inside) {
        continue;
      }

      const t = v / s;
      const r = Math.round(lerp(0x22, 0x16, t));
      const g = Math.round(lerp(0xc5, 0x80, t));
      const b = Math.round(lerp(0x5e, 0x3d, t));

      let inSymbol = false;

      if (u >= cx - stemHalf && u <= cx + stemHalf && v >= stemTop && v <= stemBottom) {
        inSymbol = true;
      }

      if (!inSymbol) {
        for (const [lx, ly, lr] of leaves) {
          const dx = u - lx;
          const dy = v - ly;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d <= lr) {
            inSymbol = true;
            break;
          }
        }
      }

      const idx = (y * s + x) * 4;
      if (inSymbol) {
        px[idx] = 0xf0;
        px[idx + 1] = 0xfd;
        px[idx + 2] = 0xf4;
      } else {
        px[idx] = r;
        px[idx + 1] = g;
        px[idx + 2] = b;
      }
      px[idx + 3] = 255;
    }
  }

  return encodePng(s, s, px);
}

const variants = [
  ['icon-192.png', 192, { maskable: false }],
  ['icon-512.png', 512, { maskable: false }],
  ['icon-maskable-512.png', 512, { maskable: true }],
];

for (const [name, size, options] of variants) {
  const out = path.join(iconsDir, name);
  writeFileSync(out, makeIcon(size, options));
  console.log(`Wrote ${path.relative(process.cwd(), out)} (${size}x${size})`);
}