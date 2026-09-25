import { S, startGame, buildOrder, RING, FIT, applyTargetAspect, relayout,
         ellipseRing, lockRing } from './game_test.mjs';

let pass=0, fail=0;
const ok=(c,m,d='')=>{ c?pass++:fail++; console.log(`  ${c?'PASS':'FAIL'}  ${m}${d?'  ('+d+')':''}`); };

console.log('--- ring fits inside the card for every plausible target aspect ---');
// aspect, label
for (const [a,label] of [[1.5,'3:2 sushi_main.jpeg'],[1.0,'1:1 printed card'],
                         [1.777,'16:9'],[0.75,'portrait 3:4'],[2.0,'2:1 wide'],[0.5,'tall 1:2']]) {
  applyTargetAspect(a);
  const halfH = .5/a;                       // card half-height in width units
  const fitsY = RING.ry < halfH;
  const fitsX = RING.rx < .5;
  ok(fitsX && fitsY, `aspect ${label}`,
     `rx=${RING.rx.toFixed(3)}<0.5  ry=${RING.ry.toFixed(3)}<${halfH.toFixed(3)}`);
}

console.log('\n--- arc-length spacing is even (labels must not collide) ---');
applyTargetAspect(1.5);
for (const n of [4,5,6,7,8]) {
  const pts = ellipseRing(n, 0);
  const gaps = pts.map((p,i)=>{ const q=pts[(i+1)%n]; return Math.hypot(p[0]-q[0],p[1]-q[1]); });
  const min=Math.min(...gaps), max=Math.max(...gaps);
  // 0.115 = label half-width 0.0575 on each of two neighbours, touching exactly
  ok(min > .115, `${n} slots clear of label overlap`, `min gap ${min.toFixed(3)}`);
  // Chord gaps differ by curvature even when arc steps are equal, so measure arc.
  const arc = (a,b)=>{ let L=0,pr=null; const M=400;
    for(let j=0;j<=M;j++){ const t=a+(b-a)*j/M, q=[RING.rx*Math.cos(t),RING.ry*Math.sin(t)];
      if(pr) L+=Math.hypot(q[0]-pr[0],q[1]-pr[1]); pr=q; } return L; };
  const th = pts.map(p=>Math.atan2(p[1]/RING.ry, p[0]/RING.rx));
  const arcs = th.map((t,i)=>{ let u=th[(i+1)%n]; if(u<=t) u+=2*Math.PI; return arc(t,u); });
  const aMin=Math.min(...arcs), aMax=Math.max(...arcs);
  ok((aMax-aMin)/aMax < .03, `${n} slots evenly spaced by arc length`,
     `spread ${((aMax-aMin)/aMax*100).toFixed(1)}%`);
}

console.log('\n--- arc-length beats equal-angle on evenness (cosmetic, not collision) ---');
{
  const n=8, naive=[];
  for(let k=0;k<n;k++){ const t=k/n*2*Math.PI; naive.push([RING.rx*Math.cos(t), RING.ry*Math.sin(t)]); }
  const g=naive.map((p,i)=>{const q=naive[(i+1)%n];return Math.hypot(p[0]-q[0],p[1]-q[1]);});
  const spreadNaive=(Math.max(...g)-Math.min(...g))/Math.max(...g);
  const e=ellipseRing(n,0);
  const ge=e.map((p,i)=>{const q=e[(i+1)%n];return Math.hypot(p[0]-q[0],p[1]-q[1]);});
  const spreadArc=(Math.max(...ge)-Math.min(...ge))/Math.max(...ge);
  ok(spreadArc < spreadNaive, 'arc-length spacing is more even than equal-angle',
     `${(spreadArc*100).toFixed(1)}% vs ${(spreadNaive*100).toFixed(1)}%`);
  ok(Math.min(...g) > .115, 'equal-angle would not actually have overlapped labels',
     `min gap ${Math.min(...g).toFixed(3)} > 0.115`);
}

console.log('\n--- relayout() moves live ingredients onto the new ring ---');
applyTargetAspect(1.0); startGame(); buildOrder();   // square -> circular ring
const before = S.items.map(i=>[i.node.position.x, i.node.position.y]);
applyTargetAspect(2.0); relayout();   // 2:1 -> squashed
const moved = S.items.some((it,i)=>Math.hypot(it.node.position.x-before[i][0],
                                              it.node.position.y-before[i][1]) > 1e-6);
ok(moved, 'items repositioned after aspect change');
ok(S.items.every(i=>Math.abs(i.node.position.y) < .5/2.0),
   'repositioned items fit the 2:1 card height');
ok(S.items.every(i=>Math.abs(Math.hypot(i.node.position.x/RING.rx, i.node.position.y/RING.ry)-1)<2e-2),
   'repositioned items land exactly on the ellipse');
ok(Math.abs(lockRing.scale.x-RING.rx)<1e-9 && Math.abs(lockRing.scale.y-RING.ry)<1e-9,
   'lock-on ring rescaled to match', `${lockRing.scale.x.toFixed(2)}x${lockRing.scale.y.toFixed(2)}`);
ok(FIT.rx > RING.rx && FIT.ry > RING.ry, 'viewport fit extent encloses the ring');

console.log(`\n${fail?`${fail} FAILED, `:'ALL '}${pass} ASPECT TESTS PASSED`);
process.exit(fail?1:0);
