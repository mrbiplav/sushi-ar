import { RING, FIT, applyTargetAspect, ellipseRing } from './game_test.mjs';
const LIFT=.02, DIST=1.05, LABEL_Z=.075, LABEL_HW=.0575, TILT=-Math.PI/2.9;
applyTargetAspect(1.5);                       // the shipped sushi_main.jpeg
let fails=0;
const devices=[['iPhone SE portrait',375,667],['iPhone 14 portrait',390,844],
  ['iPhone 14 Pro Max',430,932],['Pixel 7 portrait',412,915],
  ['iPad portrait',820,1180],['iPhone 14 landscape',844,390],
  ['iPad landscape',1180,820],['tall 20:9',360,800],['square-ish',500,500]];
for (const [label,w,h] of devices){
  const aspect=w/h, fov=60;
  const halfH=DIST*Math.tan(fov*Math.PI/360), halfW=halfH*aspect;
  const s=Math.min(1,.86*Math.min(halfW/FIT.rx, halfH/FIT.ry));
  const oy=-.08*s;
  // sample 8 ring slots, each at ingredient centre and at both label corners
  const pts=ellipseRing(8,0); const samples=[];
  for(const [x,y] of pts) for(const [dx,dz] of [[0,LIFT],[-LABEL_HW,LABEL_Z],[LABEL_HW,LABEL_Z]])
    samples.push([x+dx,y,dz]);
  let inView=0, minX=9,maxX=-9,minY=9,maxY=-9;
  for(const [x,y,z] of samples){
    // holder rotation about X, then scale+translate, then perspective divide
    const ry=y*Math.cos(TILT)-z*Math.sin(TILT), rz=y*Math.sin(TILT)+z*Math.cos(TILT);
    const X=x*s, Y=ry*s+oy, Z=rz*s-DIST;
    const px=(X/-Z)*(DIST/halfW), py=(Y/-Z)*(DIST/halfH);   // perspective divide -> NDC
    minX=Math.min(minX,px);maxX=Math.max(maxX,px);minY=Math.min(minY,py);maxY=Math.max(maxY,py);
    if(Math.abs(px)<=1&&Math.abs(py)<=1) inView++;
  }
  const pass=inView===samples.length; if(!pass)fails++;
  console.log(`${pass?'PASS':'FAIL'}  ${label.padEnd(20)} ${(w+'x'+h).padEnd(9)} scale=${s.toFixed(2)}  x[${minX.toFixed(2)},${maxX.toFixed(2)}] y[${minY.toFixed(2)},${maxY.toFixed(2)}]  ${inView}/${samples.length}`);
}
console.log(fails?`\n${fails} DEVICE(S) CLIP`:'\nALL DEVICE ASPECTS FIT');
process.exit(fails?1:0);
