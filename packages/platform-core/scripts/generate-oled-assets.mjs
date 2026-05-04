import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");
const inPath = path.join(repoRoot, "assets", "cellSymphonyLogoSepia128.png");
const outPath = path.join(repoRoot, "packages", "platform-core", "src", "oledAssets", "logoSepia128_rgb565be.ts");

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function toRgb565(r, g, b) {
  const r5 = clamp((r * 31 + 127) / 255, 0, 31) | 0;
  const g6 = clamp((g * 63 + 127) / 255, 0, 63) | 0;
  const b5 = clamp((b * 31 + 127) / 255, 0, 31) | 0;
  return (r5 << 11) | (g6 << 5) | b5;
}

const input = fs.readFileSync(inPath);
const png = PNG.sync.read(input);
if (png.width !== 128 || png.height !== 128) {
  throw new Error(`Expected 128x128 PNG, got ${png.width}x${png.height}`);
}

const bytes = new Uint8Array(128 * 128 * 2);
for (let y = 0; y < 128; y += 1) {
  for (let x = 0; x < 128; x += 1) {
    const idx = (y * 128 + x) * 4;
    const r = png.data[idx] ?? 0;
    const g = png.data[idx + 1] ?? 0;
    const b = png.data[idx + 2] ?? 0;
    const a = png.data[idx + 3] ?? 255;

    const rr = (r * a) / 255;
    const gg = (g * a) / 255;
    const bb = (b * a) / 255;
    const v = toRgb565(rr, gg, bb);
    const out = (y * 128 + x) * 2;
    bytes[out] = (v >> 8) & 0xff;
    bytes[out + 1] = v & 0xff;
  }
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
const arr = Array.from(bytes);
const body = `// Generated from assets/cellSymphonyLogoSepia128.png
// Format: rgb565be, size: 128x128
export const logoSepia128Rgb565be = new Uint8Array(${JSON.stringify(arr)});
`;
fs.writeFileSync(outPath, body, "utf8");
console.log(`Wrote ${outPath}`);
