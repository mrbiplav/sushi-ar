/**
 * Build a node-loadable copy of the game module out of index.html.
 *
 * The game ships as one self-contained HTML file, so the only way to test the
 * logic without a browser is to lift the <script type="module"> body out, front
 * it with a browser stub, and export the internals. Doing that by hand let the
 * harness drift out of sync with the real file, so it is scripted now.
 *
 * Usage:
 *     node tools/mktest.mjs <index.html> <stub.mjs> <out.mjs>
 */
import fs from 'node:fs';

const [inPath, stubPath, outPath] = process.argv.slice(2);
if (!inPath || !stubPath || !outPath) {
  console.error('usage: node mktest.mjs <index.html> <stub.mjs> <out.mjs>');
  process.exit(2);
}

const html = fs.readFileSync(inPath, 'utf8');

// The importmap is also a <script>, so match on the module type specifically.
const m = html.match(/<script type="module">([\s\S]*?)<\/script>/);
if (!m) { console.error('no <script type="module"> found in ' + inPath); process.exit(1); }

// Bare specifiers resolve via the browser importmap, which node has no idea
// about. three is a real dependency here; mindar is only reached inside
// startAR(), which the tests never call, so its dynamic import stays untouched.
const body = m[1].replace(/^\s*import\s+\*\s+as\s+THREE\s+from\s+'three';?\s*$/m,
                          "import * as THREE from 'three';");

const EXPORTS = [
  'S', 'ING', 'RECIPES', 'update', 'startGame', 'buildOrder', 'acceptItem',
  'penalise', 'board', 'paletteRoot', 'buildSpot', 'tweens', 'gameOver',
  'RING', 'FIT', 'applyTargetAspect', 'relayout', 'ellipseRing', 'lockRing', 'matMesh',
];

fs.writeFileSync(outPath,
  fs.readFileSync(stubPath, 'utf8') + '\n' + body +
  `\nexport { ${EXPORTS.join(', ')} };\n`);

console.log(`wrote ${outPath}  (module body ${body.split('\n').length} lines, ` +
            `${EXPORTS.length} exports)`);
