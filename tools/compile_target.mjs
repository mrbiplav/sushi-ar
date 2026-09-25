/**
 * Compile an image into MindAR's binary `.mind` descriptor, offline.
 *
 * This is the same job MindAR's browser-based compiler does, run headlessly so
 * the repo can ship a ready-to-use targets.mind with no manual step.
 *
 * Requires (in the directory you run this from):
 *     npm install mind-ar@1.2.5 canvas
 *
 * Usage:
 *     node compile_target.mjs <input-image> <output.mind>
 */
import { OfflineCompiler } from 'mind-ar/src/image-target/offline-compiler.js';
import { loadImage } from 'canvas';
import fs from 'node:fs';

const [inPath, outPath] = process.argv.slice(2);
if (!inPath || !outPath) {
  console.error('usage: node compile_target.mjs <input-image> <output.mind>');
  process.exit(2);
}

const image = await loadImage(inPath);
console.log(`loaded ${inPath}  ${image.width}x${image.height}`);

const compiler = new OfflineCompiler();
let lastLogged = -10;
const data = await compiler.compileImageTargets([image], (percent) => {
  if (percent - lastLogged >= 10) { lastLogged = percent; console.log(`  ${percent.toFixed(0)}%`); }
});

// Report feature counts — the real signal for whether a target will track well.
// Detection points live in matchingData as maxima/minima per scale level;
// tracking points live in trackingData as `points`. A thin count here means the
// artwork needs more contrast and fine detail, so check this before printing.
data.forEach((t, i) => {
  const detect = (t.matchingData || []).reduce(
    (n, m) => n + (m.maximaPoints?.length || 0) + (m.minimaPoints?.length || 0), 0);
  const track = (t.trackingData || []).reduce((n, m) => n + (m.points?.length || 0), 0);
  console.log(`target[${i}]  ${t.targetImage.width}x${t.targetImage.height}  ` +
              `detection-points=${detect} over ${(t.matchingData || []).length} scale levels  ` +
              `tracking-points=${track}`);
  console.log('  verdict: ' + (detect >= 400 && track >= 30
    ? 'GOOD — should detect fast and hold steady'
    : detect >= 200 ? 'OK — may need good lighting'
    : 'WEAK — add more contrast/detail to the artwork'));
});

fs.writeFileSync(outPath, compiler.exportData());
console.log(`wrote ${outPath}  ${fs.statSync(outPath).size} bytes`);
