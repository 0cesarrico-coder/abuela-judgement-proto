/* ABUELA'S JUDGEMENT — playable prototype
   Web-native, zero-install. Physics: matter.js. Render: canvas 2D.
   Core loop: slingshot ingredients into a swinging pot, stack Sazón, don't anger Abuela. */
'use strict';
const { Engine, Bodies, Body, Composite } = Matter;

// ---------- virtual resolution ----------
const VW = 720, VH = 1280;
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
let scale = 1, dpr = 1;
function fit(){
  const vw = window.innerWidth, vh = window.innerHeight;
  scale = Math.min(vw / VW, vh / VH);
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.style.width = (VW*scale)+'px'; cv.style.height = (VH*scale)+'px';
  cv.width = VW*dpr; cv.height = VH*dpr;
}
window.addEventListener('resize', fit); fit();

// ---------- assets ----------
const IMG = {};
function load(name, src){ return new Promise(r=>{ const i=new Image(); i.onload=()=>{IMG[name]=i;r();}; i.onerror=()=>r(); i.src=src; }); }

// ---------- audio (WebAudio synth) ----------
let AC=null; function ac(){ if(!AC) AC = new (window.AudioContext||window.webkitAudioContext)(); return AC; }
function blip(freq, dur, type='sine', vol=0.18, slideTo){
  try{ const a=ac(); const o=a.createOscillator(), g=a.createGain();
    o.type=type; o.frequency.value=freq; if(slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, a.currentTime+dur);
    g.gain.value=vol; g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime+dur);
    o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime+dur);
  }catch(e){}
}
const S = {
  tup:()=>{blip(520,0.09,'triangle',0.2,760);},
  whoosh:()=>{blip(300,0.18,'sawtooth',0.12,120);},
  thud:()=>{blip(150,0.12,'sine',0.18,90);},
  crack:()=>{for(let i=0;i<5;i++)setTimeout(()=>blip(220+Math.random()*500,0.07,'square',0.16),i*22);},
  sparkle:()=>{[660,880,1175,1568].forEach((f,i)=>setTimeout(()=>blip(f,0.14,'triangle',0.16),i*70));},
  scratch:()=>{blip(400,0.25,'sawtooth',0.2,60);},
};

// ---------- physics ----------
const engine = Engine.create(); engine.gravity.y = 1.7;
const world = engine.world;

// pot geometry
const POT = { x:VW/2, rimY:560, floorY:740, innerHalf:96, wallThk:24, hookX:VW/2, hookY:150, ropeLen:410 };
const counterY = 1060;
const loader = { x:VW/2, y:1165 };

let leftWall, rightWall, potFloor, counter;
function buildStatics(){
  const wallH = POT.floorY - POT.rimY + 30;
  const midY = (POT.rimY + POT.floorY)/2;
  leftWall  = Bodies.rectangle(POT.x-POT.innerHalf-POT.wallThk/2, midY, POT.wallThk, wallH, {isStatic:true,friction:0.4});
  rightWall = Bodies.rectangle(POT.x+POT.innerHalf+POT.wallThk/2, midY, POT.wallThk, wallH, {isStatic:true,friction:0.4});
  potFloor  = Bodies.rectangle(POT.x, POT.floorY, POT.innerHalf*2+POT.wallThk*2, POT.wallThk, {isStatic:true,friction:0.6});
  counter   = Bodies.rectangle(VW/2, counterY+60, VW+200, 120, {isStatic:true,friction:0.9});
  const lb = Bodies.rectangle(-40, VH/2, 80, VH*2, {isStatic:true});
  const rb = Bodies.rectangle(VW+40, VH/2, 80, VH*2, {isStatic:true});
  Composite.add(world, [leftWall,rightWall,potFloor,counter,lb,rb]);
}

// ---------- game state ----------
const INGR = [
  {key:'chile',   name:'CHILE',  col:'#D72638', val:120},
  {key:'ajo',     name:'AJO',     col:'#Eae3d0', val:100},
  {key:'jitomate',name:'JITOMATE',col:'#E0492f', val:130},
  {key:'cebolla', name:'CEBOLLA', col:'#C9A4C7', val:110},
  {key:'cilantro',name:'CILANTRO',col:'#5A8C3A', val:140},
];
// hand-drawn vector veg icons (always render, no emoji dependency). Draw centered at (0,0).
function drawVeg(key,x,y,s){
  ctx.save(); ctx.translate(x,y); ctx.scale(s,s); ctx.lineWidth=4; ctx.strokeStyle='#1c1714'; ctx.lineJoin='round';
  if(key==='chile'){
    ctx.fillStyle='#D72638'; ctx.beginPath(); ctx.moveTo(-2,-22);
    ctx.bezierCurveTo(16,-18,18,6,6,20); ctx.bezierCurveTo(2,26,-4,26,-7,18);
    ctx.bezierCurveTo(-14,2,-12,-14,-2,-22); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#5A8C3A'; ctx.beginPath(); ctx.moveTo(-2,-22); ctx.quadraticCurveTo(-2,-30,7,-30); ctx.quadraticCurveTo(0,-26,2,-20); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle='#fff7'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(-4,-12); ctx.quadraticCurveTo(-8,4,-2,16); ctx.stroke();
  } else if(key==='ajo'){
    ctx.fillStyle='#F4EFE6'; ctx.beginPath(); ctx.moveTo(0,22); ctx.bezierCurveTo(-20,18,-20,-6,-7,-14);
    ctx.bezierCurveTo(-2,-26,2,-26,7,-14); ctx.bezierCurveTo(20,-6,20,18,0,22); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.lineWidth=2.5; ctx.beginPath(); ctx.moveTo(-7,-12); ctx.quadraticCurveTo(-10,12,-2,21); ctx.moveTo(7,-12); ctx.quadraticCurveTo(10,12,2,21); ctx.stroke();
    ctx.fillStyle='#cdbfa0'; ctx.beginPath(); ctx.moveTo(0,-16); ctx.lineTo(-3,-24); ctx.lineTo(3,-24); ctx.closePath(); ctx.fill();
  } else if(key==='jitomate'){
    ctx.fillStyle='#E0492f'; ctx.beginPath(); ctx.arc(0,4,20,0,6.28); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#fff5'; ctx.beginPath(); ctx.arc(-7,-3,5,0,6.28); ctx.fill();
    ctx.fillStyle='#5A8C3A'; ctx.lineWidth=3;
    for(let i=0;i<5;i++){ ctx.save(); ctx.rotate(i*1.256); ctx.beginPath(); ctx.moveTo(0,-14); ctx.lineTo(-4,-22); ctx.lineTo(4,-22); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
  } else if(key==='cebolla'){
    ctx.fillStyle='#C9A4C7'; ctx.beginPath(); ctx.moveTo(0,-18); ctx.bezierCurveTo(20,-16,22,14,0,22); ctx.bezierCurveTo(-22,14,-20,-16,0,-18); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.lineWidth=2.5; ctx.strokeStyle='#9d7a9b'; ctx.beginPath(); ctx.moveTo(0,-16); ctx.quadraticCurveTo(-8,4,0,21); ctx.moveTo(0,-16); ctx.quadraticCurveTo(8,4,0,21); ctx.stroke();
    ctx.strokeStyle='#7a9a4a'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(-4,-18); ctx.lineTo(-7,-28); ctx.moveTo(4,-18); ctx.lineTo(7,-28); ctx.moveTo(0,-19); ctx.lineTo(0,-30); ctx.stroke();
  } else { // cilantro
    ctx.fillStyle='#5A8C3A'; ctx.strokeStyle='#3e6b2c';
    [[-10,2,-0.5],[10,2,0.5],[0,-8,0]].forEach(p=>{ ctx.save(); ctx.translate(p[0],p[1]); ctx.rotate(p[2]);
      ctx.beginPath(); ctx.moveTo(0,12); ctx.bezierCurveTo(-10,2,-8,-12,0,-16); ctx.bezierCurveTo(8,-12,10,2,0,12); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); });
    ctx.strokeStyle='#3e6b2c'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(0,12); ctx.lineTo(0,22); ctx.stroke();
  }
  ctx.restore();
}
const VERDICTS = [
  '«NIÑO FLOJO, VAS A TERMINAR\nCOMIENDO DEL McDONALD\'S»',
  '«AY, MIJO… NI PARA EL ADOBO\nSIRVES»',
  '«ESO NI TU TÍA LO COME»',
  '«CON RAZÓN NADIE TE\nINVITA A COMER»',
  '«QUÉ CONYAS ASES, CRIATURA»',
];

let G = null;
function newGame(){
  // clear dynamic bodies
  Composite.allBodies(world).forEach(b=>{ if(!b.isStatic) Composite.remove(world,b); });
  G = {
    state:'play', score:0, sazon:0, sazonTier:5000, misses:0, maxMiss:3,
    t:0, swingAmp:20, swingSpd:0.018, potX:POT.x, potTilt:0,
    ingredients:[], current:null, next:rand(INGR), particles:[], floats:[],
    aiming:false, aimStart:null, aimNow:null, shake:0, hitstop:0, shots:0,
    abuelaMood:'zen', moodT:0, record: +(localStorage.getItem('aj_record')||0),
    moneyshot:null, slowmo:1,
  };
  spawnNext();
}
function rand(a){ return a[(Math.random()*a.length)|0]; }
function spawnNext(){ G.current = G.next; G.next = rand(INGR); }

// ---------- input ----------
function toV(e){
  const r = cv.getBoundingClientRect();
  const cx = (e.touches?e.touches[0].clientX:e.clientX) - r.left;
  const cy = (e.touches?e.touches[0].clientY:e.clientY) - r.top;
  return { x: cx/r.width*VW, y: cy/r.height*VH };
}
function down(e){ e.preventDefault(); if(!G||G.state!=='play'||!G.current) return; if(AC&&AC.state==='suspended')AC.resume();
  const p=toV(e); G.aiming=true; G.aimStart={x:loader.x,y:loader.y}; G.aimNow=p; }
function move(e){ if(!G||!G.aiming) return; e.preventDefault(); G.aimNow=toV(e); }
function up(e){ if(!G||!G.aiming) return; e.preventDefault(); G.aiming=false; launch(); }
cv.addEventListener('mousedown',down); window.addEventListener('mousemove',move); window.addEventListener('mouseup',up);
cv.addEventListener('touchstart',down,{passive:false}); window.addEventListener('touchmove',move,{passive:false}); window.addEventListener('touchend',up,{passive:false});

function aimVector(){
  // pull back from loader; fling toward where pull points away
  let dx = G.aimStart.x - G.aimNow.x, dy = G.aimStart.y - G.aimNow.y;
  const mag = Math.hypot(dx,dy), max=260;
  if(mag>max){ dx=dx/mag*max; dy=dy/mag*max; }
  return {x:dx, y:dy, mag:Math.min(mag,max)};
}
function launch(){
  const v = aimVector();
  if(v.mag < 26){ return; } // too small, ignore
  const it = G.current; spawnNext();
  const b = Bodies.rectangle(loader.x, loader.y, 78, 96, {restitution:0.08, friction:0.7, frictionStatic:1, chamfer:{radius:14}, density:0.0016});
  b.plugin = { it, judged:false, slow:0, scored:false, born:G.t };
  Composite.add(world, b);
  Body.setVelocity(b, { x:v.x*0.165, y:v.y*0.165 });
  Body.setAngularVelocity(b, (Math.random()-0.5)*0.08);
  G.ingredients.push(b);
  G.shots++;
  S.whoosh();
}

// ---------- update ----------
function setMood(m){ G.abuelaMood=m; G.moodT=0; }
function judge(b){
  const p=b.plugin; p.judged=true;
  const inX = Math.abs(b.position.x - G.potX) < POT.innerHalf+18;
  const inY = b.position.y < POT.floorY+24 && b.position.y > POT.rimY-90;
  if(inX && inY){
    p.scored=true; p.counted=true;
    const add = b.plugin.it.val + Math.floor(G.combo||0)*10;
    G.score += add; G.sazon += add;
    G.combo = (G.combo||0)+1;
    burst(b.position.x, b.position.y, '#F2A93B', 14);
    floatText(b.position.x, b.position.y-30, '+'+add, '#F2A93B');
    S.tup(); setMood('happy');
    if(G.sazon >= G.sazonTier){ legendario(); }
  } else {
    miss(b);
  }
}
function miss(b){
  if(b.plugin.counted) return;            // guard: count a body's miss only once
  b.plugin.counted=true; b.plugin.judged=true;
  G.combo=0; G.misses++; G.shake=16; S.crack(); setMood('mad');
  floatText(b.position.x, b.position.y-20, '¡FUCHI!', '#D72638');
  burst(b.position.x, b.position.y, '#D72638', 10);
  // fade & remove the offending body shortly
  b.plugin.dead = G.t+30;
  if(G.misses >= G.maxMiss){ startMoneyshot(); }
}
function legendario(){
  G.sazonTier += 5000; G.sazon = 0; S.sparkle(); setMood('proud');
  floatText(VW/2, 360, '¡SAZÓN LEGENDARIO!', '#fff'); G.shake=8;
}
function burst(x,y,col,n){ for(let i=0;i<n;i++){ const a=Math.random()*6.28, s=2+Math.random()*5; G.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,life:1,col,r:3+Math.random()*4}); } }
function floatText(x,y,txt,col){ G.floats.push({x,y,txt,col,life:1}); }

let last=performance.now();
function loop(now){
  const dt = Math.min(40, now-last); last=now; if(!G){ requestAnimationFrame(loop); return; }
  G.t++;
  if(G.hitstop>0){ G.hitstop--; } else {
    const ts = G.slowmo;
    // swing servo: amplitude grows slightly with score
    if(G.state==='play'){ G.swingAmp = 20 + Math.min(G.score/120, 70); G.swingSpd = 0.016 + Math.min(G.score/200000,0.01); }
    const theta = Math.sin(G.t*G.swingSpd)*(G.swingAmp*Math.PI/180);
    G.potX = POT.hookX + POT.ropeLen*Math.sin(theta);
    G.potTilt = theta*0.35;
    // move pot walls
    const wallH = POT.floorY-POT.rimY+30, midY=(POT.rimY+POT.floorY)/2;
    Body.setPosition(leftWall,{x:G.potX-POT.innerHalf-POT.wallThk/2,y:midY});
    Body.setPosition(rightWall,{x:G.potX+POT.innerHalf+POT.wallThk/2,y:midY});
    Body.setPosition(potFloor,{x:G.potX,y:POT.floorY});
    Engine.update(engine, 16.6*ts);
  }
  // judge settling
  for(const b of G.ingredients){
    const p=b.plugin; if(p.judged) continue;
    const sp = Math.hypot(b.velocity.x,b.velocity.y);
    if(sp<1.4 && b.position.y>POT.rimY-140) p.slow++; else p.slow=0;
    if(p.slow>16) judge(b);
    if(b.position.y>VH+120 && !p.judged) miss(b);
  }
  // remove dead
  for(let i=G.ingredients.length-1;i>=0;i--){ const b=G.ingredients[i]; if(b.plugin.dead && G.t>b.plugin.dead){ Composite.remove(world,b); G.ingredients.splice(i,1); } }
  // particles
  for(let i=G.particles.length-1;i>=0;i--){ const q=G.particles[i]; q.x+=q.vx;q.y+=q.vy;q.vy+=0.35;q.life-=0.03; if(q.life<=0)G.particles.splice(i,1); }
  for(let i=G.floats.length-1;i>=0;i--){ const f=G.floats[i]; f.y-=1.1; f.life-=0.018; if(f.life<=0)G.floats.splice(i,1); }
  if(G.shake>0)G.shake*=0.86;
  G.moodT++; if(G.moodT>70 && G.abuelaMood!=='zen' && G.state==='play') setMood('zen');
  if(G.moneyshot) updateMoneyshot();
  draw();
  requestAnimationFrame(loop);
}

// ---------- draw ----------
function draw(){
  ctx.save(); ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,VW,VH);
  const sh = G.shake||0; ctx.translate((Math.random()-0.5)*sh,(Math.random()-0.5)*sh);
  // bg
  if(IMG.bg) ctx.drawImage(IMG.bg,0,0,VW,VH); else { ctx.fillStyle='#E2C9A0'; ctx.fillRect(0,0,VW,VH); }
  // rope
  ctx.strokeStyle='#6b4a2a'; ctx.lineWidth=5; ctx.beginPath(); ctx.moveTo(POT.hookX,POT.hookY); ctx.lineTo(G.potX,POT.rimY-10); ctx.stroke();
  // pot body BEHIND ingredients so the stack is visible inside
  drawPot();
  // ingredients (in pot / world)
  for(const b of G.ingredients) drawIngredient(b);
  // pot front rim + handles OVER ingredients
  drawPotFront();
  // current loader + aim
  drawLoader();
  // particles
  for(const q of G.particles){ ctx.globalAlpha=Math.max(0,q.life); ctx.fillStyle=q.col; ctx.beginPath(); ctx.arc(q.x,q.y,q.r,0,6.28); ctx.fill(); }
  ctx.globalAlpha=1;
  // floats
  for(const f of G.floats){ ctx.globalAlpha=Math.max(0,f.life); ctx.font='900 34px Trebuchet MS'; ctx.textAlign='center'; ctx.lineWidth=5; ctx.strokeStyle='#1c1714'; ctx.fillStyle=f.col; ctx.strokeText(f.txt,f.x,f.y); ctx.fillText(f.txt,f.x,f.y); }
  ctx.globalAlpha=1;
  drawHUD();
  if(G.moneyshot) drawMoneyshot();
  ctx.restore();
}

function drawPot(){
  ctx.save(); ctx.translate(G.potX,(POT.rimY+POT.floorY)/2); ctx.rotate(G.potTilt);
  const iw=POT.innerHalf, fy=(POT.floorY-POT.rimY)/2+12;
  // body
  ctx.fillStyle='#2A5C7A'; ctx.strokeStyle='#15323f'; ctx.lineWidth=8;
  ctx.beginPath();
  ctx.moveTo(-iw-14,-fy+18);
  ctx.quadraticCurveTo(-iw-30,fy, 0, fy+14);
  ctx.quadraticCurveTo(iw+30,fy, iw+14,-fy+18);
  ctx.lineTo(iw+14,-fy+6); ctx.lineTo(-iw-14,-fy+6); ctx.closePath();
  ctx.fill(); ctx.stroke();
  // inner back wall (so contents read as inside)
  ctx.fillStyle='#1c3a4d'; ctx.beginPath(); ctx.ellipse(0,-fy+6,iw,11,0,0,6.28); ctx.fill();
  // specks on body
  ctx.fillStyle='#1c3a4d'; [[-30,30],[40,18],[8,46]].forEach(p=>{ctx.beginPath();ctx.arc(p[0],p[1],3,0,6.28);ctx.fill();});
  ctx.restore();
}
function drawPotFront(){
  ctx.save(); ctx.translate(G.potX,(POT.rimY+POT.floorY)/2); ctx.rotate(G.potTilt);
  const iw=POT.innerHalf, fy=(POT.floorY-POT.rimY)/2+12;
  // front lip (lower half of rim) over contents
  ctx.fillStyle='#5a89a8'; ctx.lineWidth=8; ctx.strokeStyle='#15323f';
  ctx.beginPath(); ctx.ellipse(0,-fy+6,iw+18,16,0,0,Math.PI); ctx.fill(); ctx.stroke();
  // rim outline (full, thin) to seal the top edge
  ctx.beginPath(); ctx.ellipse(0,-fy+6,iw+18,16,0,Math.PI,2*Math.PI); ctx.stroke();
  // handles
  ctx.lineWidth=7; ctx.strokeStyle='#15323f';
  ctx.beginPath(); ctx.arc(-iw-16,-fy+24,16,0.4,3.5); ctx.stroke();
  ctx.beginPath(); ctx.arc(iw+16,-fy+24,16,-0.6,2.7); ctx.stroke();
  ctx.restore();
}
function drawIngredient(b){
  const it=b.plugin.it; const a=b.plugin.dead?Math.max(0,(b.plugin.dead-G.t)/30):1;
  ctx.save(); ctx.globalAlpha=a; ctx.translate(b.position.x,b.position.y); ctx.rotate(b.angle);
  roundRect(-39,-48,78,96,14); ctx.fillStyle='#F7F0DC'; ctx.fill(); ctx.lineWidth=5; ctx.strokeStyle='#1c1714'; ctx.stroke();
  ctx.fillStyle=it.col+'33'; roundRect(-33,-42,66,40,8); ctx.fill();
  drawVeg(it.key,0,-18,0.95);
  ctx.font='900 13px Trebuchet MS'; ctx.fillStyle='#1c1714'; ctx.textAlign='center'; ctx.fillText(it.name,0,32);
  ctx.restore(); ctx.textBaseline='alphabetic';
}
function drawLoader(){
  if(G.state!=='play'||!G.current) return;
  // slingshot posts
  ctx.strokeStyle='#6b4a2a'; ctx.lineWidth=10;
  // aim
  if(G.aiming){
    const v=aimVector();
    // bands
    ctx.strokeStyle='#5A8C3A'; ctx.lineWidth=9;
    ctx.beginPath(); ctx.moveTo(loader.x-44,loader.y); ctx.lineTo(G.aimNow.x,G.aimNow.y); ctx.moveTo(loader.x+44,loader.y); ctx.lineTo(G.aimNow.x,G.aimNow.y); ctx.stroke();
    // trajectory dots
    let px=loader.x, py=loader.y, vx=v.x*0.165, vy=v.y*0.165;
    ctx.fillStyle='rgba(28,23,20,.5)';
    for(let i=0;i<26;i++){ px+=vx; py+=vy; vy+=1.7*0.166; if(i%2===0){ctx.beginPath();ctx.arc(px,py,4-i*0.07,0,6.28);ctx.fill();} if(py>VH)break; }
    // dragged piece
    drawCard(G.aimNow.x,G.aimNow.y,G.current,1);
  } else {
    drawCard(loader.x,loader.y,G.current,1);
  }
  // next preview
  ctx.globalAlpha=.85; drawCard(VW-70,loader.y,G.next,0.62); ctx.globalAlpha=1;
  ctx.font='900 13px Trebuchet MS'; ctx.fillStyle='#1c1714aa'; ctx.textAlign='center'; ctx.fillText('SIGUE',VW-70,loader.y-44);
  // first-shot hint
  if(G.shots===0 && !G.aiming){
    const a=0.55+0.35*Math.sin(G.t*0.12);
    ctx.globalAlpha=a; ctx.font='900 22px Trebuchet MS'; ctx.fillStyle='#1c1714'; ctx.textAlign='center';
    ctx.fillText('👆 jala y suelta hacia la olla', VW/2, loader.y-70); ctx.globalAlpha=1;
  }
}
function drawCard(x,y,it,s){
  ctx.save(); ctx.translate(x,y); ctx.scale(s,s);
  roundRect(-39,-48,78,96,14); ctx.fillStyle='#F7F0DC'; ctx.fill(); ctx.lineWidth=5; ctx.strokeStyle='#1c1714'; ctx.stroke();
  ctx.fillStyle=it.col+'33'; roundRect(-33,-42,66,40,8); ctx.fill();
  drawVeg(it.key,0,-18,0.95);
  ctx.font='900 13px Trebuchet MS'; ctx.fillStyle='#1c1714'; ctx.textAlign='center'; ctx.fillText(it.name,0,32);
  ctx.restore(); ctx.textBaseline='alphabetic';
}
function roundRect(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }

// ---------- HUD ----------
function drawHUD(){
  // top bar gradient
  ctx.fillStyle='rgba(20,15,11,.0)';
  // sazon meter
  const mx=150,my=54,mw=420,mh=26;
  ctx.fillStyle='rgba(0,0,0,.28)'; roundRect(mx-4,my-4,mw+8,mh+8,16); ctx.fill();
  ctx.fillStyle='#3a2c20'; roundRect(mx,my,mw,mh,12); ctx.fill();
  const frac=Math.max(0,Math.min(1,G.sazon/G.sazonTier));
  const grd=ctx.createLinearGradient(mx,0,mx+mw,0); grd.addColorStop(0,'#F2A93B'); grd.addColorStop(1,'#ffd98a');
  ctx.fillStyle=grd; roundRect(mx,my,mw*frac,mh,12); ctx.fill();
  ctx.lineWidth=4; ctx.strokeStyle='#1c1714'; roundRect(mx,my,mw,mh,12); ctx.stroke();
  ctx.font='900 20px Trebuchet MS'; ctx.fillStyle='#fff'; ctx.textAlign='left'; ctx.strokeText('SAZÓN',mx,my-12); ctx.fillText('SAZÓN',mx,my-12);
  // score
  ctx.font='900 46px Trebuchet MS'; ctx.textAlign='left'; ctx.lineWidth=6; ctx.strokeStyle='#1c1714'; ctx.fillStyle='#fff';
  ctx.strokeText(G.score.toLocaleString(),mx,140); ctx.fillText(G.score.toLocaleString(),mx,140);
  // abuela avatar
  drawAvatar(78,86,58);
  // misses (chiles = vidas)
  for(let i=0;i<G.maxMiss;i++){ ctx.globalAlpha = i<(G.maxMiss-G.misses)?1:0.16; drawVeg('chile', VW-34-i*42, 122, 0.62); }
  ctx.globalAlpha=1;
  // record
  ctx.textAlign='right'; ctx.font='900 16px Trebuchet MS'; ctx.fillStyle='#1c1714aa'; ctx.fillText('RÉCORD '+G.record.toLocaleString(),VW-20,184);
}
function drawAvatar(x,y,r){
  ctx.save();
  const pulse = G.abuelaMood==='happy'?1+0.08*Math.sin(G.t*0.4): G.abuelaMood==='mad'?1.06: G.abuelaMood==='proud'?1.05:1;
  ctx.translate(x,y); ctx.scale(pulse,pulse);
  ctx.beginPath(); ctx.arc(0,0,r,0,6.28); ctx.closePath();
  ctx.fillStyle='#E2C9A0'; ctx.fill();
  ctx.save(); ctx.clip();
  if(IMG.abuela){ const im=IMG.abuela; const s=im.width; // sample face region
    const sx=s*0.22, sy=im.height*0.28, sw=s*0.56, sh=s*0.56;
    ctx.drawImage(im,sx,sy,sw,sh,-r,-r-6,r*2,r*2); }
  if(G.abuelaMood==='mad'){ ctx.fillStyle='rgba(215,38,56,.32)'; ctx.fillRect(-r,-r,r*2,r*2); }
  ctx.restore();
  ctx.lineWidth=6; ctx.strokeStyle='#1c1714'; ctx.beginPath(); ctx.arc(0,0,r,0,6.28); ctx.stroke();
  // mood emoji badge
  const badge = G.abuelaMood==='happy'?'😊':G.abuelaMood==='mad'?'😤':G.abuelaMood==='proud'?'🥲':'👀';
  ctx.font='26px serif'; ctx.textAlign='center'; ctx.fillText(badge,r-6,r-2);
  ctx.restore();
}

// ---------- MONEYSHOT ----------
let camStream=null, camVideo=null;
function startMoneyshot(){
  G.state='over'; G.slowmo=0.25; S.scratch();
  G.record = Math.max(G.record, G.score); localStorage.setItem('aj_record', G.record);
  G.moneyshot = { phase:'slow', t:0, crack:0, chiliX:VW/2, chiliY:200, verdict:rand(VERDICTS), cam:false };
  // attempt camera
  requestCam();
  setTimeout(()=>{ if(G.moneyshot) G.moneyshot.phase='crack'; S.crack(); G.shake=26; }, 520);
}
function requestCam(){
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia) return;
  navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:480,height:480},audio:false})
    .then(st=>{ camStream=st; camVideo=document.createElement('video'); camVideo.srcObject=st; camVideo.playsInline=true; camVideo.muted=true; camVideo.play(); if(G.moneyshot)G.moneyshot.cam=true; })
    .catch(()=>{});
}
function updateMoneyshot(){ const m=G.moneyshot; m.t++; if(m.phase==='crack'&&m.crack<1)m.crack=Math.min(1,m.crack+0.08); if(m.t===2) showOverlayButtons(); }
function drawMoneyshot(){
  const m=G.moneyshot;
  ctx.fillStyle='rgba(15,10,8,.72)'; ctx.fillRect(0,0,VW,VH);
  // crack
  if(m.crack>0) drawCrack(VW/2,300,m.crack);
  // selfie / placeholder framed as retablo
  const fw=300,fh=300,fx=VW/2-fw/2,fy=470;
  ctx.save(); ctx.fillStyle='#caa'; roundRect(fx-12,fy-12,fw+24,fh+24,18); ctx.fill();
  ctx.lineWidth=8; ctx.strokeStyle='#F2A93B'; ctx.stroke();
  roundRect(fx,fy,fw,fh,10); ctx.save(); ctx.clip();
  if(m.cam&&camVideo&&camVideo.readyState>=2){ ctx.save(); ctx.translate(fx+fw,fy); ctx.scale(-1,1); const vr=camVideo.videoWidth/camVideo.videoHeight||1; ctx.drawImage(camVideo,0,0,fw,fh); ctx.restore(); ctx.fillStyle='rgba(242,169,59,.18)'; ctx.fillRect(fx,fy,fw,fh); }
  else { ctx.fillStyle='#8b969d'; ctx.fillRect(fx,fy,fw,fh); ctx.font='120px serif'; ctx.textAlign='center'; ctx.fillText('😱',VW/2,fy+200); ctx.font='900 18px Trebuchet MS'; ctx.fillStyle='#fff'; ctx.fillText('TU CARA AQUÍ',VW/2,fy+fh-24); }
  ctx.restore(); ctx.restore();
  // chili at impact
  ctx.font='54px serif'; ctx.textAlign='center'; ctx.fillText('🌶️',VW/2+90,300);
  // SFX
  ctx.save(); ctx.translate(150,250); ctx.rotate(-0.12); ctx.font='900 44px Trebuchet MS'; ctx.lineWidth=6; ctx.strokeStyle='#1c1714'; ctx.fillStyle='#F2A93B'; ctx.strokeText('¡ZAS!',0,0); ctx.fillText('¡ZAS!',0,0); ctx.restore();
  // verdict banner
  const by=820; ctx.save(); ctx.translate(VW/2,by); ctx.fillStyle='#F2A93B'; roundRect(-VW/2+24,-50,VW-48,104,16); ctx.fill(); ctx.lineWidth=6; ctx.strokeStyle='#1c1714'; ctx.stroke();
  ctx.fillStyle='#1c1714'; ctx.font='900 30px Trebuchet MS'; ctx.textAlign='center';
  m.verdict.split('\n').forEach((ln,i)=>ctx.fillText(ln,0,-2+i*34));
  ctx.restore();
}
function drawCrack(cx,cy,k){
  ctx.save(); ctx.strokeStyle='rgba(245,247,250,'+(0.5+0.5*k)+')'; ctx.lineWidth=3;
  const rays=[[-40,-120],[55,-110],[-80,-20],[100,10],[-30,140],[60,120],[0,-160],[-110,60],[120,80],[-60,200],[70,210]];
  rays.forEach((r,i)=>{ ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+r[0]*k*2.2,cy+r[1]*k*2.2); ctx.stroke(); });
  ctx.lineWidth=2; ctx.beginPath(); for(let i=0;i<rays.length;i++){ const a=rays[i],b=rays[(i+1)%rays.length]; ctx.moveTo(cx+a[0]*k*1.3,cy+a[1]*k*1.3); ctx.lineTo(cx+b[0]*k*1.3,cy+b[1]*k*1.3);} ctx.stroke();
  ctx.fillStyle='#F5F7FA'; ctx.beginPath(); ctx.arc(cx,cy,7*k,0,6.28); ctx.fill();
  ctx.restore();
}

// ---------- DOM overlay buttons for game over ----------
function showOverlayButtons(){
  if(document.getElementById('ov')) return;
  const ov=document.createElement('div'); ov.id='ov';
  ov.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:40;display:flex;flex-direction:column;gap:10px;align-items:center;padding:0 0 24px;';
  ov.innerHTML=`
   <button id="b_share" style="${btn('#5A8C3A')}">📤 COMPARTIR</button>
   <button id="b_perdon" style="${btn('#F2A93B','#1c1714')}">🙏 PEDIR PERDÓN A ABUELA</button>
   <button id="b_retry" style="background:none;border:none;color:#eee;font-weight:800;font-size:16px;text-decoration:underline;">reintentar</button>`;
  document.body.appendChild(ov);
  document.getElementById('b_share').onclick=shareShot;
  document.getElementById('b_perdon').onclick=perdon;
  document.getElementById('b_retry').onclick=()=>{ closeOver(); newGame(); };
}
function btn(bg,fg='#fff'){ return `background:${bg};color:${fg};border:4px solid #1c1714;border-radius:16px;font-weight:900;font-size:20px;padding:14px 26px;width:min(86vw,360px);box-shadow:0 5px 0 rgba(0,0,0,.35);`; }
function closeOver(){ const o=document.getElementById('ov'); if(o)o.remove(); stopCam(); G.moneyshot=null; G.slowmo=1; }
function stopCam(){ if(camStream){ camStream.getTracks().forEach(t=>t.stop()); camStream=null; } }
function perdon(){ // simulated rewarded -> revive
  closeOver(); G.misses=Math.max(0,G.misses-2); G.state='play'; G.slowmo=1; setMood('zen'); spawnNext(); S.sparkle();
}
function shareShot(){
  // composite a share image at virtual res
  const off=document.createElement('canvas'); off.width=VW; off.height=VH; const o=off.getContext('2d');
  o.drawImage(cv,0,0,VW,VH);
  // seal
  o.fillStyle='rgba(0,0,0,.5)'; o.font='900 18px Trebuchet MS'; o.textAlign='center'; o.fillText('◆ ABUELA\'S JUDGEMENT ◆ jugá tú',VW/2,VH-20);
  off.toBlob(blob=>{
    const file=new File([blob],'abuela-judgement.png',{type:'image/png'});
    if(navigator.canShare&&navigator.canShare({files:[file]})){ navigator.share({files:[file],title:'Abuela\'s Judgement',text:G.moneyshot.verdict.replace(/\n/g,' ')}).catch(()=>{}); }
    else { const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='abuela-judgement.png'; a.click(); }
  },'image/png');
}

// ---------- boot ----------
Promise.all([ load('bg','assets/kitchen-bg.png'), load('abuela','assets/abuela.png') ]).then(()=>{ buildStatics(); requestAnimationFrame(loop); });
document.getElementById('tapstart').addEventListener('click',()=>{ document.getElementById('tapstart').classList.add('hidden'); if(!AC)ac(); if(AC&&AC.state==='suspended')AC.resume(); newGame(); });
// allow keyboard restart
window.addEventListener('keydown',e=>{ if(e.key==='r'&&G){ closeOver&&document.getElementById('ov')&&closeOver(); newGame(); } });
