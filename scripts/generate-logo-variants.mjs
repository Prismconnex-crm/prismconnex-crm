/**
 * Generates the Prismconnex logo asset.
 *
 *   public/images/prismconnex-logo.png  (source, brand blue #025C9C)
 *     -> public/images/logo-blue.png       (#005C9D, light mode)
 *     -> public/images/logo-blue-dark.png  (#0086E6, dark mode)
 *
 * #005C9D (rgb 0 92 157) is the shared primary brand colour, declared as
 * `--brand` in app/globals.css, where the Login / Sign Up tabs and the primary
 * buttons pick it up through the Tailwind `brand` token. #0086E6 is likewise
 * `--brand-hover`. A PNG cannot read a CSS variable, so the constants below are
 * the one unavoidable second copy — change both together, and re-run this
 * script afterwards.
 *
 * The dark variant exists because #005C9D is only 2.77:1 on the #0A0E1A auth
 * background and 2.47:1 on the #111B2E sidebar — dark enough to read as a smudge.
 * Dark mode steps up to `--brand-hover` (5.09:1 / 4.55:1), the same substitution
 * the dark-mode link text and focus borders already make.
 *
 * An earlier revision emitted a *white* variant and dropped it when the logo was
 * made one fixed blue. This is not that: the mark stays brand blue in both
 * themes, one step lighter on dark. Don't reintroduce the white one.
 *
 * The source is an 8-bit *palette* PNG (colour type 3) whose 256 PLTE entries
 * are all the same colour, with a tRNS chunk supplying per-index alpha. In
 * other words the artwork is one flat colour plus an alpha mask.
 *
 * That makes recolouring a palette swap: rewrite the RGB triples in PLTE and
 * recompute that chunk's CRC. IHDR, tRNS and IDAT are copied through byte for
 * byte, so the pixel data — and therefore the logo's shape, proportions and
 * anti-aliased edges — is provably unchanged. No decoding, no re-encoding, no
 * image library (the project has none installed, deliberately).
 *
 * Run: node scripts/generate-logo-variants.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "public/images/prismconnex-logo.png");

const VARIANTS = [
  // Keep in sync with `--brand` / `--brand-hover` in app/globals.css.
  { file: "public/images/logo-blue.png", hex: "#005C9D" },
  { file: "public/images/logo-blue-dark.png", hex: "#0086E6" },
];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function parseHex(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Not a 6-digit hex colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** Returns a copy of `png` with every PLTE entry set to `rgb`. */
function recolourPalette(png, rgb) {
  const out = Buffer.from(png);
  let offset = 8; // skip the 8-byte PNG signature
  let found = false;

  while (offset < out.length) {
    const length = out.readUInt32BE(offset);
    const type = out.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;

    if (type === "PLTE") {
      if (length % 3 !== 0) throw new Error("Malformed PLTE chunk");
      for (let i = 0; i < length; i += 3) {
        out[dataStart + i] = rgb[0];
        out[dataStart + i + 1] = rgb[1];
        out[dataStart + i + 2] = rgb[2];
      }
      // CRC covers the chunk type and its data, not the length field.
      out.writeUInt32BE(crc32(out.subarray(offset + 4, dataStart + length)), dataStart + length);
      found = true;
    }

    if (type === "IEND") break;
    offset = dataStart + length + 4; // + 4-byte CRC
  }

  if (!found) throw new Error("Source PNG has no PLTE chunk — it is not a palette PNG");
  return out;
}

const source = readFileSync(SOURCE);

for (const { file, hex } of VARIANTS) {
  const target = join(ROOT, file);
  writeFileSync(target, recolourPalette(source, parseHex(hex)));
  console.log(`${file} <- ${hex}`);
}
