import * as THREE from 'three';

const LIFT = 0.02;

let pass = 0, fail = 0;
const ok = (c, m, d = '') => {
  c ? pass++ : fail++;
  console.log(`  ${c ? 'PASS' : 'FAIL'}  ${m}${d ? '  (' + d + ')' : ''}`);
};

/** Apply the billboard transform from index.html as a pure function.
 *  For testing, we apply the transform repeatedly until convergence. */
function applyBillboardTransform(camera, board, buildSpot, numLayers) {
  // Apply transform multiple times to converge (since slerp is 0.12 per frame)
  for (let iter = 0; iter < 50; iter++) {
    const tempPos = new THREE.Vector3();
    camera.getWorldPosition(tempPos);
    const cameraLocalPos = board.worldToLocal(tempPos.clone());
    const stackCenter = new THREE.Vector3(0, 0, LIFT + .014 + (numLayers - 1) * .026 / 2);
    const d = new THREE.Vector3().subVectors(cameraLocalPos, stackCenter);
    const distSq = d.lengthSq();
    if (distSq >= 0.0001) {
      d.normalize();
      const tempQuat = new THREE.Quaternion();
      camera.getWorldQuaternion(tempQuat);
      const boardQuat = new THREE.Quaternion();
      board.getWorldQuaternion(boardQuat);
      const localQuat = boardQuat.clone().invert().multiply(tempQuat);
      const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(localQuat);
      const dot = camUp.dot(d);
      const u = camUp.clone().addScaledVector(d, -dot);
      if (u.lengthSq() < 0.0001) {
        u.set(camUp.x, camUp.y, 0);
        if (u.lengthSq() < 0.0001) u.set(0, 1, 0);
      }
      u.normalize();
      const localZ = new THREE.Vector3(0, 0, 1);
      const targetQuat = new THREE.Quaternion().setFromUnitVectors(localZ, u);
      const prevQuat = buildSpot.quaternion.clone();
      buildSpot.quaternion.slerp(targetQuat, 0.12);
      // Check convergence: if quaternion changed by less than 0.001, we're done
      if (prevQuat.angleTo(buildSpot.quaternion) < 0.001) break;
    }
  }
}

/** Test a single camera pose. */
function testPose(label, cameraPos, cameraLookAt) {
  const board = new THREE.Group();
  const buildSpot = new THREE.Group();
  board.add(buildSpot);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 20);
  camera.position.set(...cameraPos);
  camera.lookAt(...cameraLookAt);
  camera.updateMatrixWorld();

  // Place 4 layers in buildSpot local space
  const numLayers = 4;
  const layerZ = [
    LIFT + .014,       // 0.034
    LIFT + .014 + .026, // 0.060
    LIFT + .014 + .052, // 0.086
    LIFT + .014 + .078, // 0.112
  ];

  // Apply billboard transform
  applyBillboardTransform(camera, board, buildSpot, numLayers);

  // Update matrices
  board.updateMatrixWorld();
  buildSpot.updateMatrixWorld();

  // Check for NaN/Infinity in quaternion
  const q = buildSpot.quaternion;
  const validQuat = !isNaN(q.x) && !isNaN(q.y) && !isNaN(q.z) && !isNaN(q.w) &&
                    isFinite(q.x) && isFinite(q.y) && isFinite(q.z) && isFinite(q.w);
  ok(validQuat, `${label}: quaternion valid`,
     `q=(${q.x.toFixed(3)},${q.y.toFixed(3)},${q.z.toFixed(3)},${q.w.toFixed(3)})`);

  // Project each layer to NDC
  const ndcs = layerZ.map(z => {
    const localPos = new THREE.Vector3(0, 0, z);
    const worldPos = buildSpot.localToWorld(localPos);
    return worldPos.project(camera);
  });

  // Assert adjacent layer separation in NDC Y coordinate
  for (let i = 0; i < numLayers - 1; i++) {
    const sep = Math.abs(ndcs[i + 1].y - ndcs[i].y);
    ok(sep >= 0.08, `${label}: layers ${i}→${i+1} separated`,
       `NDC Y sep ${sep.toFixed(3)} ≥ 0.08`);
  }
}

console.log('--- billboard transform separates stacked layers in all viewing angles ---');

// Test 1: Overhead (0, 0, 0.5)
testPose('overhead', [0, 0, 0.5], [0, 0, 0]);

// Test 2: 30° oblique from east
{
  const angle = 30 * Math.PI / 180;
  const r = 0.5;
  const x = r * Math.cos(angle);
  const z = r * Math.sin(angle);
  testPose('30° from east', [x, 0, z], [0, 0, 0]);
}

// Test 3: 45° oblique from east
{
  const angle = 45 * Math.PI / 180;
  const r = 0.5;
  const x = r * Math.cos(angle);
  const z = r * Math.sin(angle);
  testPose('45° from east', [x, 0, z], [0, 0, 0]);
}

// Test 4: 60° oblique from east
{
  const angle = 60 * Math.PI / 180;
  const r = 0.5;
  const x = r * Math.cos(angle);
  const z = r * Math.sin(angle);
  testPose('60° from east', [x, 0, z], [0, 0, 0]);
}

// Test 5: 30° from north
{
  const angle = 30 * Math.PI / 180;
  const r = 0.5;
  const y = r * Math.cos(angle);
  const z = r * Math.sin(angle);
  testPose('30° from north', [0, y, z], [0, 0, 0]);
}

// Test 6: 45° northeast
{
  const angle = 45 * Math.PI / 180;
  const r = 0.5;
  const xy = r * Math.cos(angle);
  const z = r * Math.sin(angle);
  testPose('45° northeast', [xy / Math.SQRT2, xy / Math.SQRT2, z], [0, 0, 0]);
}

console.log('\n--- degenerate case: camera on stack axis with jitter ---');
// Test 7: Degenerate case - camera nearly on axis (at typical AR distance)
// Tests that the fallback logic handles the singularity without NaN
for (const [dx, dy] of [[0.001, 0], [-0.001, 0], [0, 0.001], [0, -0.001]]) {
  const board = new THREE.Group();
  const buildSpot = new THREE.Group();
  board.add(buildSpot);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 20);
  camera.position.set(dx, dy, 0.5);  // Use AR viewing distance, not far away
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();

  const numLayers = 4;
  applyBillboardTransform(camera, board, buildSpot, numLayers);

  board.updateMatrixWorld();
  buildSpot.updateMatrixWorld();

  const q = buildSpot.quaternion;
  const validQuat = !isNaN(q.x) && !isNaN(q.y) && !isNaN(q.z) && !isNaN(q.w) &&
                    isFinite(q.x) && isFinite(q.y) && isFinite(q.z) && isFinite(q.w);
  ok(validQuat, `degenerate (${dx},${dy},0.5): quaternion valid`,
     `q=(${q.x.toFixed(3)},${q.y.toFixed(3)},${q.z.toFixed(3)},${q.w.toFixed(3)})`);

  const layerZ = [
    LIFT + .014,
    LIFT + .014 + .026,
    LIFT + .014 + .052,
    LIFT + .014 + .078,
  ];

  const ndcs = layerZ.map(z => {
    const localPos = new THREE.Vector3(0, 0, z);
    const worldPos = buildSpot.localToWorld(localPos);
    return worldPos.project(camera);
  });

  // At AR viewing distance with singularity handling, expect reasonable separation
  for (let i = 0; i < 3; i++) {
    const sep = Math.abs(ndcs[i + 1].y - ndcs[i].y);
    ok(sep >= 0.05, `degenerate (${dx},${dy},0.5): layers ${i}→${i+1} separated`,
       `NDC Y sep ${sep.toFixed(3)} ≥ 0.05`);
  }
}

console.log(`\n${fail ? `${fail} FAILED, ` : 'ALL '}${pass} STACK TESTS PASSED`);
process.exit(fail ? 1 : 0);
