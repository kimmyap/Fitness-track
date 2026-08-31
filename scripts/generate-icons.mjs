// Generates the PWA icon set from code — no image dependencies.
// Run: node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const ORANGE = [0xf9, 0x73, 0x16]; // --primary
const WHITE = [0xff, 0xff, 0xff];
const SS = 4; // supersampling factor per axis (antialiasing)

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
const png = (w, h, rgba) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

// --- shapes, in normalised 0..1 space ---
const inRoundedRect = (x, y, r) => {
  if (x < 0 || x > 1 || y < 0 || y > 1) return false;
  const cx = Math.min(Math.max(x, r), 1 - r);
  const cy = Math.min(Math.max(y, r), 1 - r);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
};
const rect = (x, y, x0, x1, y0, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
// A dumbbell: centre bar + two plates each side.
const inDumbbell = (x, y) =>
  rect(x, y, 0.30, 0.70, 0.455, 0.545) || // bar
  rect(x, y, 0.155, 0.235, 0.33, 0.67) || // outer plate L
  rect(x, y, 0.245, 0.295, 0.385, 0.615) || // inner plate L
  rect(x, y, 0.765, 0.845, 0.33, 0.67) || // outer plate R
  rect(x, y, 0.705, 0.755, 0.385, 0.615); // inner plate R

function render(size, { radius, glyphScale }) {
  const buf = Buffer.alloc(size * size * 4);
  const half = 1 / (2 * SS);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bg = 0;
      let fg = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (px + (sx / SS + half)) / size;
          const v = (py + (sy / SS + half)) / size;
          if (inRoundedRect(u, v, radius)) bg++;
          // scale the glyph about the centre for maskable safe-zones
          const gu = (u - 0.5) / glyphScale + 0.5;
          const gv = (v - 0.5) / glyphScale + 0.5;
          if (inDumbbell(gu, gv)) fg++;
        }
      }
      const total = SS * SS;
      const bgA = bg / total;
      const fgA = fg / total;
      const i = (py * size + px) * 4;
      // composite white glyph over orange plate, over transparency
      for (let c = 0; c < 3; c++) {
        buf[i + c] = Math.round(ORANGE[c] * (1 - fgA) + WHITE[c] * fgA);
      }
      buf[i + 3] = Math.round(255 * Math.max(bgA, Math.min(fgA, bgA)));
    }
  }
  return png(size, size, buf);
}

mkdirSync('public/icons', { recursive: true });
const targets = [
  ['public/icons/icon-192.png', 192, { radius: 0.22, glyphScale: 1 }],
  ['public/icons/icon-512.png', 512, { radius: 0.22, glyphScale: 1 }],
  // maskable: full-bleed square, glyph pulled into the ~60% safe zone
  ['public/icons/icon-maskable-512.png', 512, { radius: 0, glyphScale: 0.7 }],
  // iOS applies its own mask, so ship it square and full-bleed
  ['public/icons/apple-touch-icon.png', 180, { radius: 0, glyphScale: 1 }],
];
for (const [path, size, opts] of targets) {
  writeFileSync(path, render(size, opts));
  console.log(`wrote ${path} (${size}x${size})`);
}
