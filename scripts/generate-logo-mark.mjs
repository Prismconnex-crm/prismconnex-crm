/**
 * Generates the emblem-only Prismconnex mark.
 *
 *   public/images/prismconnex-logo.png  (source lockup: emblem + wordmark)
 *     -> public/images/logo-mark-blue.png       (#005C9D, light mode)
 *     -> public/images/logo-mark-blue-dark.png  (#0086E6, dark mode)
 *
 * This is the companion to generate-logo-variants.mjs. That script recolours the
 * *whole lockup* — emblem stacked over "Prismconnex / GLOBAL SOLUTIONS". At the
 * 36x36 the app shell and navbar render it into, the wordmark collapses into an
 * illegible smear and the mark reads as a grey rectangle rather than a logo. The
 * fix is to ship a second asset containing only the emblem, so the small sizes
 * get the circle-and-peaks mark and the adjacent text is real DOM text.
 *
 * Colours match generate-logo-variants.mjs exactly: #005C9D is `--brand` from
 * app/globals.css, #0086E6 is `--brand-hover`. Dark mode steps up because
 * #005C9D is only 2.47:1 on the #111B2E sidebar. Those two hexes now live in
 * three places — globals.css and both scripts — so change them together.
 *
 * The source is an 8-bit *palette* PNG (colour type 3): 256 PLTE entries all the
 * same colour, with tRNS supplying per-index alpha. Recolouring is therefore a
 * palette swap, exactly as the sibling script does it.
 *
 * Cropping, unlike recolouring, cannot be done on the compressed bytes — the
 * scanlines have to be inflated, unfiltered, sliced and re-deflated. That is
 * done here with node:zlib alone; the project deliberately has no image library
 * installed and this script does not add one. Re-encoding uses filter type 0 on
 * every row, which is larger than an optimal filter choice but is a few KB on a
 * 522x522 single-colour image and keeps the code readable.
 *
 * CROP_* below is the emblem's alpha bounding box in the source, measured by
 * scanning tRNS alpha per row: the artwork occupies rows 0-521, the wordmark
 * starts at row 552, and the emblem spans columns 134-645. The box is widened
 * by five columns on each side to 522x522 so the emblem lands square and
 * centred — square matters because every caller renders it into a square box.
 *
 * Run: node scripts/generate-logo-mark.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CROP_X = 129;
const CROP_Y = 0;
const CROP_W = 522;
const CROP_H = 522;

const LIGHT = { r: 0x00, g: 0x5c, b: 0x9d };
const DARK = { r: 0x00, g: 0x86, b: 0xe6 };

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(root, "public/images/prismconnex-logo.png");
const OUT_LIGHT = join(root, "public/images/logo-mark-blue.png");
const OUT_DARK = join(root, "public/images/logo-mark-blue-dark.png");

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** CRC-32, as PNG specifies it — the polynomial is fixed by the format. */
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function readChunks(buf) {
  if (!buf.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error("not a PNG");
  const chunks = [];
  let offset = 8;
  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    chunks.push({ type, data: buf.subarray(offset + 8, offset + 8 + length) });
    offset += 12 + length;
  }
  return chunks;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
}

/**
 * Reverses the per-scanline filter PNG applies before compression, returning one
 * palette index per pixel. Only colour type 3 / bit depth 8 is handled, which is
 * what the source is; anything else would need a general decoder and is rejected
 * by the caller rather than silently mis-decoded.
 */
function unfilter(raw, width, height) {
  const pixels = Buffer.alloc(width * height);
  let read = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[read++];
    const line = raw.subarray(read, read + width);
    read += width;
    const row = pixels.subarray(y * width, (y + 1) * width);
    const prior = y > 0 ? pixels.subarray((y - 1) * width, y * width) : null;
    for (let x = 0; x < width; x++) {
      const left = x >= 1 ? row[x - 1] : 0;
      const up = prior ? prior[x] : 0;
      const upLeft = prior && x >= 1 ? prior[x - 1] : 0;
      let value = line[x];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) {
        const estimate = left + up - upLeft;
        const dLeft = Math.abs(estimate - left);
        const dUp = Math.abs(estimate - up);
        const dUpLeft = Math.abs(estimate - upLeft);
        value += dLeft <= dUp && dLeft <= dUpLeft ? left : dUp <= dUpLeft ? up : upLeft;
      } else if (filter !== 0) {
        throw new Error(`unsupported filter type ${filter} on row ${y}`);
      }
      row[x] = value & 0xff;
    }
  }
  return pixels;
}

const source = readFileSync(SOURCE);
const chunks = readChunks(source);
const ihdr = chunks.find((c) => c.type === "IHDR");
const plte = chunks.find((c) => c.type === "PLTE");
const trns = chunks.find((c) => c.type === "tRNS");
if (!ihdr || !plte) throw new Error("source PNG is missing IHDR or PLTE");

const width = ihdr.data.readUInt32BE(0);
const height = ihdr.data.readUInt32BE(4);
const bitDepth = ihdr.data[8];
const colorType = ihdr.data[9];
if (bitDepth !== 8 || colorType !== 3) {
  throw new Error(`expected an 8-bit palette PNG, got depth ${bitDepth} type ${colorType}`);
}
if (CROP_X + CROP_W > width || CROP_Y + CROP_H > height) {
  throw new Error(`crop box ${CROP_W}x${CROP_H}+${CROP_X}+${CROP_Y} exceeds ${width}x${height}`);
}

const idat = Buffer.concat(chunks.filter((c) => c.type === "IDAT").map((c) => c.data));
const pixels = unfilter(inflateSync(idat), width, height);

// One scanline per cropped row: a leading filter byte (0 = None) then the
// palette indices sliced out of the corresponding source row.
const scanlines = Buffer.alloc(CROP_H * (CROP_W + 1));
for (let y = 0; y < CROP_H; y++) {
  const from = (CROP_Y + y) * width + CROP_X;
  scanlines[y * (CROP_W + 1)] = 0;
  pixels.copy(scanlines, y * (CROP_W + 1) + 1, from, from + CROP_W);
}
const croppedIdat = deflateSync(scanlines, { level: 9 });

const croppedIhdr = Buffer.from(ihdr.data);
croppedIhdr.writeUInt32BE(CROP_W, 0);
croppedIhdr.writeUInt32BE(CROP_H, 4);

function write(target, { r, g, b }) {
  // Every PLTE entry is the same colour in this artwork; the alpha mask in tRNS
  // is what draws the shape. So recolouring is filling all 256 triples.
  const palette = Buffer.alloc(plte.data.length);
  for (let i = 0; i < palette.length; i += 3) {
    palette[i] = r;
    palette[i + 1] = g;
    palette[i + 2] = b;
  }
  const parts = [PNG_SIGNATURE, chunk("IHDR", croppedIhdr), chunk("PLTE", palette)];
  if (trns) parts.push(chunk("tRNS", trns.data));
  parts.push(chunk("IDAT", croppedIdat), chunk("IEND", Buffer.alloc(0)));
  const out = Buffer.concat(parts);
  writeFileSync(target, out);
  console.log(`${target} — ${CROP_W}x${CROP_H}, ${out.length} bytes`);
}

write(OUT_LIGHT, LIGHT);
write(OUT_DARK, DARK);
