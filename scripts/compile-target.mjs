/**
 * compile-target.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Compiles the card frame template image into a MindAR .mind target file.
 *
 * Usage:
 *   node scripts/compile-target.mjs
 *
 * Output:
 *   artifacts/memory-booth/public/targets.mind
 *
 * Requirements:
 *   npm install canvas @tensorflow/tfjs-node
 *   (mind-ar is already a dep of the project)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createCanvas, loadImage } from 'canvas';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── Polyfill browser globals expected by MindAR ───────────────────────────
global.ImageData   = class ImageData {
  constructor(data, width, height) { this.data = data; this.width = width; this.height = height; }
};
global.HTMLVideoElement = class {};
global.document         = { createElement: (tag) => tag === 'canvas' ? createCanvas(1, 1) : {} };

// ── Dynamic import of MindAR compiler (ESM) ───────────────────────────────
const { Compiler } = await import(
  'mind-ar/src/image-target/compiler.js'
).catch(() => import('@hiukim/mind-ar/src/image-target/compiler.js'));

// ── Paths ─────────────────────────────────────────────────────────────────
const __dir  = dirname(fileURLToPath(import.meta.url));
const root   = resolve(__dir, '..');

const INPUT  = resolve(root, 'artifacts/memory-booth/public/print-frame-landscape.png');
const OUTPUT = resolve(root, 'artifacts/memory-booth/public/targets.mind');

console.log('📷  Loading target image:', INPUT);
const img    = await loadImage(INPUT);
const canvas = createCanvas(img.width, img.height);
const ctx    = canvas.getContext('2d');
ctx.drawImage(img, 0, 0);

const { data, width, height } = ctx.getImageData(0, 0, img.width, img.height);

console.log(`🖼   Image size: ${width} × ${height} px`);
console.log('⚙️   Compiling features (this may take 20–60 s)…');

const compiler = new Compiler();

// Progress callback
let lastPct = -1;
const result = await compiler.compileImageTargets(
  [{ width, height, data: new Uint8ClampedArray(data.buffer) }],
  (pct) => {
    const p = Math.round(pct * 100);
    if (p !== lastPct) { process.stdout.write(`\r    ${p}%`); lastPct = p; }
  }
);

console.log('\n✅  Compilation done.');

const buf = await compiler.exportData();
writeFileSync(OUTPUT, Buffer.from(buf));

console.log('💾  Saved to:', OUTPUT);
console.log('');
console.log('Physical dimensions to set in MindAR:');
console.log('  width  = 0.102 m  (102 mm)');
console.log('  height = 0.152 m  (152 mm)');
console.log('');
console.log('Done. Deploy and test with your printed card 🎉');
