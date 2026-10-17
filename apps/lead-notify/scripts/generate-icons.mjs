/**
 * Generates the Android app's icon set from code, so the artwork is
 * reproducible and reviewable instead of being three opaque binary files.
 *
 *   node scripts/generate-icons.mjs
 *
 * Everything is written with Node's built-in `zlib` — no image library is
 * installed, and adding one (sharp/canvas) for six static files would be a poor
 * trade. Run it only when the design changes; the PNGs it produces are committed.
 *
 * The motif is the product itself: a diamond lattice, which is what fiberglass
 * construction mesh looks like. Colours come from the website's brand palette
 * (tailwind.config.ts → colors.brand).
 */

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "assets",
  "images",
);

/* ───────────────────────────── brand colours ───────────────────────────── */

/** brand.500 → brand.700, the same gradient direction as the site's accents. */
const BRAND_LIGHT = [0x3b, 0x92, 0xf6];
const BRAND_DARK = [0x1d, 0x5d, 0xd8];
const WHITE = [0xff, 0xff, 0xff];

/* ────────────────────────────── png encoder ────────────────────────────── */

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

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

/** 8-bit RGBA, no interlacing, one filter byte per scanline. */
function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: truecolour + alpha
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter type 0 (none)
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ─────────────────────────────── geometry ─────────────────────────────── */

const clamp = (value, lo, hi) => (value < lo ? lo : value > hi ? hi : value);
const mix = (a, b, t) => a + (b - a) * t;

/** Signed distance to a rounded rectangle centred on the origin. */
function roundedRectSdf(px, py, halfW, halfH, radius) {
  const qx = Math.abs(px) - (halfW - radius);
  const qy = Math.abs(py) - (halfH - radius);
  return (
    Math.min(Math.max(qx, qy), 0) +
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) -
    radius
  );
}

/**
 * Anti-aliased coverage of a diamond lattice at ±45°.
 *
 * A fiberglass mesh is a square weave seen at an angle, so the lattice is
 * expressed as the distance to the nearest line of two rotated families.
 */
function latticeCoverage(dx, dy, spacing, halfWidth, antialias) {
  const u = (dx + dy) / Math.SQRT2;
  const v = (dx - dy) / Math.SQRT2;

  const du = Math.abs(u - Math.round(u / spacing) * spacing);
  const dv = Math.abs(v - Math.round(v / spacing) * spacing);

  const ramp = (distance) =>
    clamp((halfWidth + antialias - distance) / (2 * antialias), 0, 1);

  return Math.max(ramp(du), ramp(dv));
}

/* ─────────────────────────────── renderers ─────────────────────────────── */

/**
 * @param {object} options
 * @param {number} options.size      square edge length in pixels
 * @param {number} options.markScale fraction of the canvas the mark occupies
 * @param {boolean} options.plate    draw the rounded gradient plate behind the mesh
 */
function render({ size, markScale, plate }) {
  const rgba = Buffer.alloc(size * size * 4);
  const centre = (size - 1) / 2;
  const half = (size / 2) * markScale;

  // Sized so the lattice still reads at 48dp. A denser weave turns to mush once
  // the launcher downsamples the icon.
  const spacing = size * 0.18;
  const halfWidth = spacing * 0.105;
  const antialias = Math.max(1, size / 900);

  const plateRadius = half * 0.42;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - centre;
      const dy = y - centre;

      // ── the plate (only for the legacy icon and the favicon) ──
      let plateAlpha = 0;
      if (plate) {
        const sdf = roundedRectSdf(dx, dy, half, half, plateRadius);
        plateAlpha = clamp(0.5 - sdf, 0, 1);
      }

      // ── the mesh, clipped to a rounded plaque ──
      // Clipping on every layer (not just the plated one) is what gives the
      // transparent layers a deliberate edge instead of a square of pattern
      // chopped off by the launcher's mask.
      const meshAlpha =
        latticeCoverage(dx, dy, spacing, halfWidth, antialias) *
        clamp(0.5 - roundedRectSdf(dx, dy, half - 2, half - 2, plateRadius - 2), 0, 1);

      const alpha = plate ? Math.max(plateAlpha, meshAlpha * plateAlpha) : meshAlpha;
      let colour;

      if (plate) {
        // Diagonal gradient across the plate, brand.500 → brand.700.
        const t = clamp((dx + dy) / (2 * half) + 0.5, 0, 1);
        colour = [
          mix(BRAND_LIGHT[0], BRAND_DARK[0], t),
          mix(BRAND_LIGHT[1], BRAND_DARK[1], t),
          mix(BRAND_LIGHT[2], BRAND_DARK[2], t),
        ];
      } else {
        colour = [...WHITE];
      }

      // Composite the white weave on top of the plate colour.
      const coverage = alpha > 0 ? clamp((meshAlpha * (plate ? plateAlpha : 1)) / alpha, 0, 1) : 0;
      const r = mix(colour[0], WHITE[0], coverage);
      const g = mix(colour[1], WHITE[1], coverage);
      const b = mix(colour[2], WHITE[2], coverage);

      const offset = (y * size + x) * 4;
      rgba[offset] = Math.round(clamp(r, 0, 255));
      rgba[offset + 1] = Math.round(clamp(g, 0, 255));
      rgba[offset + 2] = Math.round(clamp(b, 0, 255));
      rgba[offset + 3] = Math.round(clamp(alpha, 0, 1) * 255);
    }
  }

  return encodePng(size, size, rgba);
}

/** A flat gradient square with no mesh — the adaptive icon's background layer. */
function renderPlate(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const centre = (size - 1) / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const t = clamp(((x - centre) + (y - centre)) / size + 0.5, 0, 1);
      const offset = (y * size + x) * 4;
      rgba[offset] = Math.round(mix(BRAND_LIGHT[0], BRAND_DARK[0], t));
      rgba[offset + 1] = Math.round(mix(BRAND_LIGHT[1], BRAND_DARK[1], t));
      rgba[offset + 2] = Math.round(mix(BRAND_LIGHT[2], BRAND_DARK[2], t));
      rgba[offset + 3] = 255;
    }
  }
  return encodePng(size, size, rgba);
}

/* ──────────────────────────────── outputs ──────────────────────────────── */

mkdirSync(OUT_DIR, { recursive: true });

/**
 * Adaptive icons are masked to a circle/squircle by the launcher, which can crop
 * up to ~33 % of the layer. The mark therefore stays inside the central 62 %.
 * The monochrome layer is tinted by the system, so it is drawn as a plain white
 * silhouette.
 */
const FILES = [
  // Legacy launcher icon: full-bleed rounded square, own background.
  ["icon.png", render({ size: 1024, markScale: 0.95, plate: true })],
  // Adaptive icon layers. 108dp canvas, 72dp safe zone → markScale 0.62.
  ["android-icon-foreground.png", render({ size: 1024, markScale: 0.62, plate: false })],
  ["android-icon-background.png", renderPlate(1024)],
  ["android-icon-monochrome.png", render({ size: 1024, markScale: 0.62, plate: false })],
  // Splash screen (shown on the brand-blue background set in app.json).
  ["splash-icon.png", render({ size: 512, markScale: 0.9, plate: false })],
  // Web favicon.
  ["favicon.png", render({ size: 96, markScale: 0.95, plate: true })],
];

for (const [name, buffer] of FILES) {
  writeFileSync(join(OUT_DIR, name), buffer);
  console.log(`  wrote ${name}  ${(buffer.length / 1024).toFixed(1)} KB`);
}

console.log(`\nDone — ${FILES.length} icons in ${OUT_DIR}`);
