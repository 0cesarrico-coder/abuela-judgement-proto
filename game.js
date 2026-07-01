/* ABUELA'S JUDGEMENT — playable prototype
   Web-native, zero-install. Physics: matter.js. Render: canvas 2D.
   Core loop: slingshot ingredients into a swinging pot, stack Sazón, don't anger Abuela. */
'use strict';
const { Engine, Bodies, Body, Composite } = Matter;
// Fonts (loaded via Google Fonts in index.html). UI = Montserrat grotesk; DISP = Bungee rótulo.
const UIF = "Montserrat, 'Segoe UI', sans-serif";
const DISP = "Bungee, 'Montserrat', sans-serif";

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
let AC=null; let MUTED = localStorage.getItem('aj_muted')==='1';
function ac(){ if(!AC) AC = new (window.AudioContext||window.webkitAudioContext)(); return AC; }
function blip(freq, dur, type='sine', vol=0.18, slideTo){
  if(MUTED) return;
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

// ---------- music + Abuela voice (real generated audio; fully mutable) ----------
// NOTE: música y voz fueron generadas con Higgsfield (Sonilo / TTS). Verificar de oído.
let MUSIC=null, MUSIC_VOL=0.38; const VOICE={}; let VOICE_ON = localStorage.getItem('aj_voice')!=='0';
function initAudioFiles(){
  try{
    MUSIC = new Audio('assets/audio/music-zen.m4a'); MUSIC.loop=true; MUSIC.volume=0; MUSIC.preload='auto';
    ['v0','v1','v2','v3','v4','proud'].forEach(k=>{ const a=new Audio('assets/audio/'+k+'.mp3'); a.preload='auto'; a.volume=0.95; VOICE[k]=a; });
  }catch(e){}
}
let _mfade=null;
function fadeMusic(to){ if(!MUSIC) return; clearInterval(_mfade); _mfade=setInterval(()=>{ const v=MUSIC.volume; if(Math.abs(v-to)<0.03){ MUSIC.volume=to; clearInterval(_mfade); if(to===0)MUSIC.pause(); return;} MUSIC.volume=v+(to>v?0.03:-0.03); },70); }
function startMusic(){ if(!MUSIC||MUTED) return; MUSIC.play().then(()=>fadeMusic(MUSIC_VOL)).catch(()=>{}); }
function stopMusic(){ if(MUSIC){ MUSIC.pause(); } }
function playVoice(k){ if(MUTED||!VOICE_ON) return; const a=VOICE[k]; if(!a) return; try{ a.currentTime=0; a.play().catch(()=>{}); }catch(e){}; if(MUSIC&&!MUSIC.paused){ MUSIC.volume=0.12; setTimeout(()=>{ if(MUSIC&&!MUSIC.paused)fadeMusic(MUSIC_VOL); },2600); } }
function stopAllVoice(){ Object.values(VOICE).forEach(a=>{ try{a.pause();a.currentTime=0;}catch(e){} }); }

// ---------- physics ----------
const engine = Engine.create(); engine.gravity.y = 1.25;
const world = engine.world;

// pot geometry (lower + wider mouth so arcs drop in easily)
const POT = { x:VW/2, rimY:672, floorY:744, innerHalf:140, wallThk:22, hookX:VW/2, hookY:150, ropeLen:520 };
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
  leftWall.isPot=rightWall.isPot=potFloor.isPot=true;
  Composite.add(world, [leftWall,rightWall,potFloor,counter,lb,rb]);
  // ONE-WAY pot: ingredients moving up while still below the rim pass through the
  // pot floor/walls and the existing stack; once inside (or descending) they collide & settle.
  Matter.Events.on(engine,'collisionStart', ev=>{
    for(const pair of ev.pairs){
      const a=pair.bodyA, b=pair.bodyB;
      const ingA=a.plugin&&a.plugin.it, ingB=b.plugin&&b.plugin.it;
      const belowMouth = (body)=> body.position.y > POT.rimY+6;
      if((a.isPot&&ingB)||(b.isPot&&ingA)){
        const ing = ingA? a : b;
        if(ing.velocity.y < 0.3 && belowMouth(ing)) pair.isActive=false; // rising & below rim → pass
      } else if(ingA&&ingB){
        const riser = (a.velocity.y<-2 && belowMouth(a)) ? a : (b.velocity.y<-2 && belowMouth(b)) ? b : null;
        if(riser) pair.isActive=false; // an incoming rising piece passes through the stack
      }
    }
  });
}

// ---------- game state ----------
const INGR = [
  {key:'chile',   name:'CHILE',  col:'#D72638', val:120, num:'7'},
  {key:'ajo',     name:'AJO',     col:'#Eae3d0', val:100, num:'12'},
  {key:'jitomate',name:'JITOMATE',col:'#E0492f', val:130, num:'23'},
  {key:'cebolla', name:'CEBOLLA', col:'#C9A4C7', val:110, num:'31'},
  {key:'cilantro',name:'CILANTRO',col:'#5A8C3A', val:140, num:'46'},
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

// ---------- RECETAS DE LA ABUELA (progression) ----------
// Cook escalating dishes; each has a Sazón goal + difficulty tier. Completing one =
// celebration + Abuela proud + recover a life, then the next (harder) dish begins.
const RECIPES = [
  {name:'SALSA ROJA', goal:650,  emoji:'🌶️'},
  {name:'GUACAMOLE',  goal:1050, emoji:'🥑'},
  {name:'PICO DE GALLO', goal:1500, emoji:'🍅'},
  {name:'MOLE',       goal:2100, emoji:'🫕'},
  {name:'POZOLE',     goal:2900, emoji:'🍲'},
  {name:'TAMALES',    goal:3900, emoji:'🫔'},
  {name:'BIRRIA',     goal:5200, emoji:'🥩'},
];
function recipeAt(i){
  if(i < RECIPES.length) return RECIPES[i];
  const n = i - RECIPES.length + 2;                    // beyond the list → endless "banquetes"
  return {name:'BANQUETE '+n, goal:5200 + (i-RECIPES.length+1)*1600, emoji:'🎉'};
}
// ingredient selection with an occasional CHILE DE ORO (golden: ×3 + guaranteed combo)
const GOLD = {key:'chile', name:'ORO', col:'#FFC53D', val:300, num:'★', gold:true};
let _sinceGold = 0;
function pickIngredient(){
  _sinceGold++;
  if(_sinceGold >= 6 && Math.random() < 0.30){ _sinceGold = 0; return GOLD; }
  return rand(INGR);
}

let G = null;
function newGame(){
  // clear dynamic bodies
  Composite.allBodies(world).forEach(b=>{ if(!b.isStatic) Composite.remove(world,b); });
  _sinceGold = 0;
  G = {
    state:'play', score:0, sazon:0, misses:0, maxMiss:3,
    recipeIdx:0, recipe:recipeAt(0), dishesDone:0, banner:null,
    t:0, swingAmp:20, swingSpd:0.018, potX:POT.x, potTilt:0,
    ingredients:[], current:null, next:pickIngredient(), particles:[], floats:[], rings:[], steam:[],
    aiming:false, aimStart:null, aimNow:null, shake:0, hitstop:0, shots:0,
    abuelaMood:'zen', moodT:0, record: +(localStorage.getItem('aj_record')||0),
    bestDish: +(localStorage.getItem('aj_bestdish')||0),
    moneyshot:null, slowmo:1, flash:0, combo:0, bestCombo:0,
  };
  spawnNext();
  track('play');
}
function rand(a){ return a[(Math.random()*a.length)|0]; }
function spawnNext(){ G.current = G.next; G.next = pickIngredient(); }

// ---------- input ----------
function toV(e){
  const r = cv.getBoundingClientRect();
  const cx = (e.touches?e.touches[0].clientX:e.clientX) - r.left;
  const cy = (e.touches?e.touches[0].clientY:e.clientY) - r.top;
  return { x: cx/r.width*VW, y: cy/r.height*VH };
}
function down(e){ e.preventDefault(); if(!G||G.state!=='play'||!G.current) return; if(AC&&AC.state==='suspended')AC.resume();
  const p=toV(e); G.aiming=true; G.aimStart={x:loader.x,y:loader.y}; G.aimNow=p;
  if(G.abuelaMood==='zen') setMood('watch'); }
function move(e){ if(!G||!G.aiming) return; e.preventDefault(); G.aimNow=toV(e); }
function up(e){ if(!G||!G.aiming) return; e.preventDefault(); G.aiming=false; launch(); }
cv.addEventListener('mousedown',down); window.addEventListener('mousemove',move); window.addEventListener('mouseup',up);
cv.addEventListener('touchstart',down,{passive:false}); window.addEventListener('touchmove',move,{passive:false}); window.addEventListener('touchend',up,{passive:false});

function aimVector(){
  // DRAG-toward-target: throw in the direction you drag from the loader (full-screen room)
  let dx = G.aimNow.x - G.aimStart.x, dy = G.aimNow.y - G.aimStart.y;
  const mag = Math.hypot(dx,dy), max=360;
  if(mag>max){ dx=dx/mag*max; dy=dy/mag*max; }
  return {x:dx, y:dy, mag:Math.min(mag,max)};
}
const LAUNCH_K = 0.087;   // calibrated: comfortable drag arcs into the pot
let TRAJ_G = 0.49;        // matches measured matter gravity (rise=918 @ vy=30)
function launch(){
  const v = aimVector();
  if(v.mag < 12){ return; } // accidental tap
  if(v.y > -4){ return; }    // must throw upward toward the pot, not down
  const it = G.current; spawnNext();
  const b = Bodies.rectangle(loader.x, loader.y-30, 78, 96, {restitution:0.08, friction:0.7, frictionStatic:1, chamfer:{radius:14}, density:0.0016});
  b.plugin = { it, judged:false, slow:0, scored:false, counted:false, born:G.t };
  Composite.add(world, b);
  Body.setVelocity(b, { x:v.x*LAUNCH_K, y:v.y*LAUNCH_K });
  Body.setAngularVelocity(b, (Math.random()-0.5)*0.08);
  G.ingredients.push(b);
  G.shots++;
  S.whoosh();
}

// ---------- update ----------
function setMood(m){ G.abuelaMood=m; G.moodT=0; }
function judge(b){
  const p=b.plugin; p.judged=true;
  const inX = Math.abs(b.position.x - G.potX) < POT.innerHalf+34;
  const inY = b.position.y < POT.floorY+24 && b.position.y > POT.rimY-300; // tall piles still count
  if(inX && inY){
    p.scored=true; p.counted=true;
    const gold = b.plugin.it.gold;
    const add = b.plugin.it.val + Math.floor(G.combo||0)*10;
    G.score += add; G.sazon += add;
    G.combo = (G.combo||0)+1; G.bestCombo=Math.max(G.bestCombo,G.combo);
    G.hitstop = gold?5:3;                      // punch on catch (bigger for gold)
    burst(b.position.x, b.position.y, gold?'#FFD24D':'#F2A93B', gold?24:14);
    ring(b.position.x, b.position.y);
    floatText(b.position.x, b.position.y-30, (gold?'★ +':'+')+add, gold?'#FFD24D':'#F2A93B');
    if(gold){ G.flash=Math.max(G.flash,0.4); S.sparkle(); }
    if(G.combo>1) floatText(b.position.x, b.position.y-58, 'COMBO x'+G.combo, '#fff');
    (gold||G.combo>1) ? S.sparkle() : S.tup(); setMood('happy');
    if(G.sazon >= G.recipe.goal){ recipeComplete(); }
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
function recipeComplete(){
  const done = G.recipe;
  G.dishesDone++; G.bestDish = Math.max(G.bestDish, G.dishesDone); localStorage.setItem('aj_bestdish', G.bestDish);
  G.recipeIdx++; G.recipe = recipeAt(G.recipeIdx); G.sazon = 0;
  setMood('proud'); playVoice('proud'); S.sparkle();
  G.flash = 0.9; G.shake = 10; G.hitstop = 8;
  if(G.misses > 0){ G.misses--; floatText(VW-70, 150, '+1 🌶️', '#5A8C3A'); } // reward: recover a life
  // celebration burst
  for(let i=0;i<30;i++){ const a=Math.random()*6.28, s=3+Math.random()*7; G.particles.push({x:VW/2,y:420,vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,life:1,col:['#F2A93B','#FFD24D','#D72638','#5A8C3A'][i%4],r:4+Math.random()*5}); }
  G.banner = { txt:'¡'+done.name+' LISTO!', sub:'Ahora: '+G.recipe.emoji+' '+G.recipe.name, t:0 };
  track('recipe_done', { recipe:done.name, idx:G.recipeIdx, score:G.score });
}
function burst(x,y,col,n){ for(let i=0;i<n;i++){ const a=Math.random()*6.28, s=2+Math.random()*5; G.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,life:1,col,r:3+Math.random()*4}); } }
function ring(x,y){ G.rings.push({x,y,r:8,life:1}); }
function floatText(x,y,txt,col){ G.floats.push({x,y,txt,col,life:1}); }

let last=performance.now();
function loop(now){
  const dt = Math.min(40, now-last); last=now; if(!G){ requestAnimationFrame(loop); return; }
  if(HIDDEN){ requestAnimationFrame(loop); return; }   // paused while tab hidden
  G.t++;
  if(G.hitstop>0){ G.hitstop--; } else {
    const ts = G.slowmo;
    // DIFFICULTY by RECIPE: each dish swings wider & faster; gentle first dish, escalates.
    if(G.state==='play'){
      const rb = G.recipeIdx;
      G.swingAmp = Math.min(58, 4 + rb*6 + Math.min(G.score/700, 22));
      G.swingSpd = Math.min(0.030, 0.010 + rb*0.0016 + Math.min(G.score/700000, 0.007));
    }
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
    // forgiving catch funnel: a descending piece near the mouth gets nudged toward center
    if(b.velocity.y>1 && b.position.y>POT.rimY-250 && b.position.y<POT.rimY+50){
      const dxc=G.potX-b.position.x;
      if(Math.abs(dxc)<POT.innerHalf+72) Body.setVelocity(b,{x:b.velocity.x+dxc*0.013, y:b.velocity.y});
    }
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
  for(let i=G.rings.length-1;i>=0;i--){ const rr=G.rings[i]; rr.r+=4; rr.life-=0.05; if(rr.life<=0)G.rings.splice(i,1); }
  // zen steam wisps rising from the pot (ambiance)
  if(G.state==='play' && G.t%14===0){ G.steam.push({x:G.potX+(Math.random()-0.5)*120, y:POT.rimY-6, sway:Math.random()*6.28, life:1, r:8+Math.random()*8}); }
  for(let i=G.steam.length-1;i>=0;i--){ const w=G.steam[i]; w.y-=0.6; w.sway+=0.05; w.x+=Math.sin(w.sway)*0.5; w.life-=0.008; if(w.life<=0)G.steam.splice(i,1); }
  if(G.flash>0)G.flash*=0.9;
  if(G.shake>0)G.shake*=0.86;
  if(G.banner){ G.banner.t++; if(G.banner.t>150) G.banner=null; }
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
  // zen steam over the rim
  for(const w of G.steam){ ctx.globalAlpha=Math.max(0,w.life)*0.18; ctx.fillStyle='#fff'; ctx.beginPath(); ctx.ellipse(w.x,w.y,w.r*(1.4-w.life),w.r,0,0,6.28); ctx.fill(); }
  ctx.globalAlpha=1;
  // current loader + aim
  drawLoader();
  // catch rings
  for(const rr of G.rings){ ctx.globalAlpha=Math.max(0,rr.life)*0.7; ctx.strokeStyle='#F2A93B'; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(rr.x,rr.y,rr.r,0,6.28); ctx.stroke(); }
  ctx.globalAlpha=1;
  // particles
  for(const q of G.particles){ ctx.globalAlpha=Math.max(0,q.life); ctx.fillStyle=q.col; ctx.beginPath(); ctx.arc(q.x,q.y,q.r,0,6.28); ctx.fill(); }
  ctx.globalAlpha=1;
  // live combo badge near the pot
  if(G.combo>1 && G.state==='play'){ ctx.save(); ctx.translate(G.potX, POT.rimY-150); const pop=1+0.06*Math.sin(G.t*0.5); ctx.scale(pop,pop); ctx.font='26px '+DISP; ctx.textAlign='center'; ctx.lineWidth=6; ctx.strokeStyle='#1c1714'; ctx.fillStyle='#F2A93B'; ctx.strokeText('COMBO x'+G.combo,0,0); ctx.fillText('COMBO x'+G.combo,0,0); ctx.restore(); }
  // floats
  for(const f of G.floats){ ctx.globalAlpha=Math.max(0,f.life); ctx.font='900 34px Montserrat'; ctx.textAlign='center'; ctx.lineWidth=5; ctx.strokeStyle='#1c1714'; ctx.fillStyle=f.col; ctx.strokeText(f.txt,f.x,f.y); ctx.fillText(f.txt,f.x,f.y); }
  ctx.globalAlpha=1;
  drawHUD();
  if(G.banner) drawBanner();
  if(G.flash>0){ ctx.globalAlpha=Math.min(0.55,G.flash); ctx.fillStyle='#FFE9A8'; ctx.fillRect(0,0,VW,VH); ctx.globalAlpha=1; }
  if(G.moneyshot) drawMoneyshot();
  ctx.restore();
}
function drawBanner(){
  const b=G.banner, t=b.t;
  // slide-in / hold / slide-out
  const inA=Math.min(1,t/10), outA=t>120?Math.max(0,1-(t-120)/30):1, a=inA*outA;
  const y=430, pop=1+0.05*Math.sin(t*0.3);
  ctx.save(); ctx.globalAlpha=a; ctx.translate(VW/2,y); ctx.scale(pop,pop);
  // ribbon
  ctx.fillStyle='#5A8C3A'; roundRect(-300,-46,600,92,16); ctx.fill(); ctx.lineWidth=6; ctx.strokeStyle='#15110e'; ctx.stroke();
  ctx.fillStyle='#FFE9A8'; ctx.textAlign='center'; ctx.font='30px '+DISP; ctx.lineWidth=6; ctx.strokeStyle='#15110e';
  ctx.strokeText(b.txt,0,-6); ctx.fillText(b.txt,0,-6);
  ctx.font='900 20px Montserrat'; ctx.fillStyle='#fff'; ctx.strokeText(b.sub,0,26); ctx.fillText(b.sub,0,26);
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
// ---- world-class lotería card (vector folk-art, drawn centered at origin) ----
function loteriaCard(it){
  const gold = it.gold;
  // card base + black outline (gold for Chile de Oro)
  ctx.fillStyle = gold?'#C9971F':'#2A5C7A'; roundRect(-39,-48,78,96,12); ctx.fill();
  ctx.lineWidth=5; ctx.strokeStyle='#15110e'; ctx.stroke();
  // inner panel + keyline
  ctx.fillStyle = gold?'#FFF3CC':'#F4E8CC'; roundRect(-32,-41,64,82,8); ctx.fill();
  ctx.lineWidth=2; ctx.strokeStyle = gold?'#B8860B':'#D72638'; roundRect(-32,-41,64,82,8); ctx.stroke();
  // warm illustration backdrop
  const g=ctx.createRadialGradient(0,-12,3,0,-12,34); g.addColorStop(0,(gold?'#FFD24D':it.col)+'44'); g.addColorStop(1,'rgba(244,232,204,0)');
  ctx.fillStyle=g; roundRect(-30,-39,60,52,6); ctx.fill();
  // the ingredient illustration (gold chile gets a golden sheen)
  drawVeg(it.key,0,-10,1.05);
  if(gold){ ctx.globalAlpha=0.42; ctx.fillStyle='#FFC53D'; roundRect(-30,-39,60,52,6); ctx.fill(); ctx.globalAlpha=1;
    // twinkles
    const tw=[[-18,-30],[16,-24],[-8,4]]; ctx.fillStyle='#fff';
    tw.forEach((p,i)=>{ const s=1.6+1.2*Math.abs(Math.sin((G?G.t:0)*0.1+i)); ctx.beginPath(); ctx.arc(p[0],p[1],s,0,6.28); ctx.fill(); }); }
  // silkscreen grain (deterministic, anti-slop)
  ctx.fillStyle='rgba(28,17,14,.05)';
  for(let i=0;i<7;i++){ const gx=((i*53)%56)-28, gy=((i*37)%70)-39; ctx.beginPath(); ctx.arc(gx,gy,1.1,0,6.28); ctx.fill(); }
  // lotería number badge (top-left)
  ctx.fillStyle='#F4E8CC'; ctx.beginPath(); ctx.arc(-26,-34,8,0,6.28); ctx.fill();
  ctx.lineWidth=2; ctx.strokeStyle='#15110e'; ctx.stroke();
  ctx.fillStyle='#15110e'; ctx.font='900 10px Montserrat'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(it.num,-26,-33);
  // marigold corner dots
  ctx.fillStyle='#F2A93B'; [[-31,-40],[31,-40],[-31,18],[31,18]].forEach(p=>{ctx.beginPath();ctx.arc(p[0],p[1],2.4,0,6.28);ctx.fill();});
  // name banner
  ctx.fillStyle = gold?'#B8860B':'#15110e'; roundRect(-32,24,64,17,5); ctx.fill();
  ctx.fillStyle = gold?'#15110e':'#F4E8CC'; ctx.font='900 12px Montserrat'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(it.name,0,33);
  ctx.textBaseline='alphabetic';
}
function drawIngredient(b){
  const it=b.plugin.it; const a=b.plugin.dead?Math.max(0,(b.plugin.dead-G.t)/30):1;
  const age=G.t-(b.plugin.born||0); const sq = age<10 ? 1+0.12*(1-age/10) : 1; // launch squash juice
  ctx.save(); ctx.globalAlpha=a; ctx.translate(b.position.x,b.position.y); ctx.rotate(b.angle); ctx.scale(1/sq, sq);
  loteriaCard(it);
  ctx.restore();
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
    // trajectory dots (only when aiming upward)
    if(v.y < -8){
      let px=loader.x, py=loader.y-30, vx=v.x*LAUNCH_K, vy=v.y*LAUNCH_K;
      ctx.fillStyle='rgba(28,23,20,.55)';
      for(let i=0;i<40;i++){ px+=vx; py+=vy; vy+=TRAJ_G; if(i%2===0){ctx.beginPath();ctx.arc(px,py,5-i*0.07,0,6.28);ctx.fill();} if(py>VH||px<0||px>VW)break; }
    }
    // dragged piece
    drawCard(G.aimNow.x,G.aimNow.y,G.current,1);
  } else {
    drawCard(loader.x,loader.y,G.current,1);
  }
  // next preview
  ctx.globalAlpha=.85; drawCard(VW-70,loader.y,G.next,0.62); ctx.globalAlpha=1;
  ctx.font='900 13px Montserrat'; ctx.fillStyle='#1c1714aa'; ctx.textAlign='center'; ctx.fillText('SIGUE',VW-70,loader.y-44);
  // first-shot hint
  if(G.shots===0 && !G.aiming){
    const a=0.55+0.35*Math.sin(G.t*0.12);
    ctx.globalAlpha=a; ctx.font='900 22px Montserrat'; ctx.fillStyle='#1c1714'; ctx.textAlign='center';
    ctx.fillText('👆 jala y suelta hacia la olla', VW/2, loader.y-70); ctx.globalAlpha=1;
  }
}
function drawCard(x,y,it,s){
  ctx.save(); ctx.translate(x,y); ctx.scale(s,s);
  loteriaCard(it);
  ctx.restore();
}
function roundRect(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }

// ---------- HUD ----------
function drawHUD(){
  // top bar gradient
  ctx.fillStyle='rgba(20,15,11,.0)';
  // RECIPE meter — fills toward the current dish's Sazón goal
  const mx=150,my=60,mw=420,mh=24;
  ctx.fillStyle='rgba(0,0,0,.28)'; roundRect(mx-4,my-4,mw+8,mh+8,16); ctx.fill();
  ctx.fillStyle='#3a2c20'; roundRect(mx,my,mw,mh,12); ctx.fill();
  const frac=Math.max(0,Math.min(1,G.sazon/G.recipe.goal));
  const grd=ctx.createLinearGradient(mx,0,mx+mw,0); grd.addColorStop(0,'#F2A93B'); grd.addColorStop(1,'#ffd98a');
  ctx.fillStyle=grd; roundRect(mx,my,mw*frac,mh,12); ctx.fill();
  ctx.lineWidth=4; ctx.strokeStyle='#1c1714'; roundRect(mx,my,mw,mh,12); ctx.stroke();
  // recipe name (left) + goal (right)
  ctx.font='900 18px Montserrat'; ctx.textAlign='left'; ctx.lineWidth=4; ctx.strokeStyle='#1c1714'; ctx.fillStyle='#fff';
  const rlabel=G.recipe.emoji+' '+G.recipe.name;
  ctx.strokeText(rlabel,mx,my-9); ctx.fillText(rlabel,mx,my-9);
  ctx.textAlign='right'; ctx.font='900 12px Montserrat'; ctx.fillStyle='#ffe9c2';
  ctx.strokeText(G.sazon.toLocaleString()+' / '+G.recipe.goal, mx+mw, my-9); ctx.fillText(G.sazon.toLocaleString()+' / '+G.recipe.goal, mx+mw, my-9);
  // score + platillo counter
  ctx.font='36px '+DISP; ctx.textAlign='left'; ctx.lineWidth=6; ctx.strokeStyle='#1c1714'; ctx.fillStyle='#fff';
  ctx.strokeText(G.score.toLocaleString(),mx,142); ctx.fillText(G.score.toLocaleString(),mx,142);
  ctx.font='900 14px Montserrat'; ctx.lineWidth=3; ctx.fillStyle='#ffe9c2';
  ctx.strokeText('🍽 PLATILLO '+(G.recipeIdx+1),mx+3,164); ctx.fillText('🍽 PLATILLO '+(G.recipeIdx+1),mx+3,164);
  // abuela avatar
  drawAvatar(78,86,58);
  // misses (chiles = vidas)
  for(let i=0;i<G.maxMiss;i++){ ctx.globalAlpha = i<(G.maxMiss-G.misses)?1:0.16; drawVeg('chile', VW-34-i*42, 122, 0.62); }
  ctx.globalAlpha=1;
  // record
  ctx.textAlign='right'; ctx.font='900 16px Montserrat'; ctx.fillStyle='#1c1714aa'; ctx.fillText('RÉCORD '+G.record.toLocaleString(),VW-20,184);
}
function drawAvatar(x,y,r){
  ctx.save();
  const mood=G.abuelaMood, mad=(mood==='mad');
  const pulse = mood==='happy'?1+0.07*Math.sin(G.t*0.4): mad?1.07: mood==='proud'?1.05: mood==='watch'?1.02 : 1+0.015*Math.sin(G.t*0.06);
  ctx.translate(x,y); ctx.scale(pulse,pulse);
  ctx.beginPath(); ctx.arc(0,0,r,0,6.28); ctx.closePath();
  ctx.fillStyle='#C9743B'; ctx.fill();   // warm backing matching bust bg
  ctx.save(); ctx.clip();
  // reactive mood bust (real Nano Banana Pro art, consistent character set)
  const im = (mood==='happy'||mood==='proud') ? IMG.mhappy : mad ? IMG.mfuria : mood==='watch' ? IMG.mwatch : IMG.mzen;
  if(im){ ctx.drawImage(im, 44,8, 300,300, -r,-r, r*2,r*2); }
  else if(mad && IMG.furia){ ctx.drawImage(IMG.furia, 6,6, 290,290, -r,-r-4, r*2,r*2); }
  else if(IMG.abuela){ const s=IMG.abuela.width; ctx.drawImage(IMG.abuela, s*0.22, IMG.abuela.height*0.28, s*0.56, s*0.56, -r,-r-6, r*2,r*2); }
  if(mad){ ctx.fillStyle='rgba(215,38,56,.12)'; ctx.fillRect(-r,-r,r*2,r*2); }
  ctx.restore();
  // pewter + marigold lotería ring
  ctx.lineWidth=6; ctx.strokeStyle='#15110e'; ctx.beginPath(); ctx.arc(0,0,r,0,6.28); ctx.stroke();
  ctx.lineWidth=3; ctx.strokeStyle='#2A5C7A'; ctx.beginPath(); ctx.arc(0,0,r-4,0,6.28); ctx.stroke();
  // mood emoji badge
  const badge = mood==='happy'?'😊':mad?'😤':mood==='proud'?'🥲':mood==='watch'?'🤨':'👀';
  ctx.font='22px serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(badge,r-4,r-2); ctx.textBaseline='alphabetic';
  ctx.restore();
}

// ---------- MONEYSHOT ----------
let camStream=null, camVideo=null;
function startMoneyshot(){
  G.state='over'; G.slowmo=0.25; S.scratch();
  track('gameover',{score:G.score, best:Math.max(G.record,G.score), combo:G.bestCombo, shots:G.shots});
  G.record = Math.max(G.record, G.score); localStorage.setItem('aj_record', G.record);
  const vi = (Math.random()*Math.min(VERDICTS.length,5))|0;   // verdict index maps to voice v0..v4
  G.moneyshot = { phase:'slow', t:0, crack:0, chiliX:VW/2, chiliY:200, verdict:VERDICTS[vi], vi, cam:false };
  // NO camera by default — the game never takes a photo on its own. The player must opt in
  // explicitly via a button (Style Bible §5: cámara opt-in con preview).
  setTimeout(()=>{ if(!G.moneyshot) return; G.moneyshot.phase='crack'; S.crack(); G.shake=26; playVoice('v'+vi); }, 520);
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
  else { ctx.fillStyle='#8b969d'; ctx.fillRect(fx,fy,fw,fh); ctx.font='120px serif'; ctx.textAlign='center'; ctx.fillText('😱',VW/2,fy+200); ctx.font='900 17px Montserrat'; ctx.fillStyle='#fff'; ctx.fillText('📸 OPCIONAL: TU CARA',VW/2,fy+fh-24); }
  ctx.restore(); ctx.restore();
  // real Abuela FURIA bursting in (cracked cat-eye glasses, culinary panic) — beat #2
  if(IMG.furia && m.crack>0.2){ const s=Math.min(1,(m.crack-0.2)/0.5); ctx.save(); ctx.globalAlpha=s; ctx.translate(150,150); ctx.rotate(-0.06); const fw=230; ctx.drawImage(IMG.furia, 8,8, 300,300, -fw/2,-fw/2, fw,fw); ctx.restore(); ctx.globalAlpha=1; }
  // chile projectile at impact (vector, on-brand)
  drawVeg('chile', VW/2+96, 300, 1.4);
  // SFX
  ctx.save(); ctx.translate(540,250); ctx.rotate(0.1); ctx.font='40px '+DISP; ctx.lineWidth=6; ctx.strokeStyle='#1c1714'; ctx.fillStyle='#F2A93B'; ctx.textAlign='center'; ctx.strokeText('¡ZAS!',0,0); ctx.fillText('¡ZAS!',0,0); ctx.restore();
  // verdict banner
  const by=820; ctx.save(); ctx.translate(VW/2,by); ctx.fillStyle='#F2A93B'; roundRect(-VW/2+24,-50,VW-48,104,16); ctx.fill(); ctx.lineWidth=6; ctx.strokeStyle='#1c1714'; ctx.stroke();
  ctx.fillStyle='#1c1714'; ctx.font='22px '+DISP; ctx.textAlign='center';
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
   <button id="b_cam" style="background:none;border:none;color:#cfe;font-weight:800;font-size:15px;text-decoration:underline;cursor:pointer;">📸 opcional: que Abuela te vea (activa cámara)</button>
   <button id="b_retry" style="background:none;border:none;color:#eee;font-weight:800;font-size:16px;text-decoration:underline;">reintentar</button>`;
  document.body.appendChild(ov);
  document.getElementById('b_share').onclick=shareShot;
  document.getElementById('b_perdon').onclick=perdon;
  document.getElementById('b_retry').onclick=()=>{ closeOver(); newGame(); };
  const camBtn=document.getElementById('b_cam');
  camBtn.onclick=()=>{ track('cam_optin'); requestCam(); camBtn.textContent='📸 activando cámara…'; camBtn.style.opacity='0.6'; camBtn.disabled=true; };
}
function btn(bg,fg='#fff'){ return `background:${bg};color:${fg};border:4px solid #1c1714;border-radius:16px;font-weight:900;font-size:20px;padding:14px 26px;width:min(86vw,360px);box-shadow:0 5px 0 rgba(0,0,0,.35);`; }
function closeOver(){ const o=document.getElementById('ov'); if(o)o.remove(); stopCam(); G.moneyshot=null; G.slowmo=1; }
function stopCam(){ if(camStream){ camStream.getTracks().forEach(t=>t.stop()); camStream=null; } }
function perdon(){ // simulated rewarded -> revive
  track('perdon'); closeOver(); G.misses=Math.max(0,G.misses-2); G.state='play'; G.slowmo=1; setMood('zen'); spawnNext(); S.sparkle();
}
function shareShot(){
  // composite a share image at virtual res
  const off=document.createElement('canvas'); off.width=VW; off.height=VH; const o=off.getContext('2d');
  o.drawImage(cv,0,0,VW,VH);
  // viral seal: title + score + CTA
  o.fillStyle='rgba(21,17,14,.82)'; o.fillRect(0,VH-96,VW,96);
  o.fillStyle='#F2A93B'; o.font='900 32px Montserrat'; o.textAlign='center'; o.fillText("ABUELA'S JUDGEMENT",VW/2,VH-58);
  o.fillStyle='#F4E8CC'; o.font='900 22px Montserrat'; o.fillText('Mi sazón: '+G.score.toLocaleString()+'  ·  ¿le aguantas? 🌶️',VW/2,VH-26);
  off.toBlob(blob=>{
    const file=new File([blob],'abuela-judgement.png',{type:'image/png'});
    track('share');
    if(navigator.canShare&&navigator.canShare({files:[file]})){ navigator.share({files:[file],title:'Abuela\'s Judgement',text:G.moneyshot.verdict.replace(/\n/g,' ')+' — ¿le aguantas a la Abuela? 🌶️'}).catch(()=>{}); }
    else { const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='abuela-judgement.png'; a.click(); }
  },'image/png');
}

// ---------- analytics (privacy-light: local counters + optional beacon) ----------
function track(ev, data){
  try{
    const k='aj_stats', s=JSON.parse(localStorage.getItem(k)||'{}');
    s[ev]=(s[ev]||0)+1; localStorage.setItem(k, JSON.stringify(s));
    // Point window.AJ_ANALYTICS_URL at an endpoint to collect aggregate, no-PII events.
    const url=window.AJ_ANALYTICS_URL;
    if(url && navigator.sendBeacon){ navigator.sendBeacon(url, JSON.stringify(Object.assign({ev}, data||{}))); }
  }catch(e){}
}
// ---------- UI: mute toggle ----------
function buildMuteBtn(){
  if(document.getElementById('mute')) return;
  const b=document.createElement('button'); b.id='mute';
  b.style.cssText='position:fixed;top:10px;right:10px;z-index:25;width:44px;height:44px;border-radius:12px;border:3px solid #15110e;background:rgba(20,15,11,.55);color:#F4E8CC;font-size:20px;cursor:pointer;';
  const paint=()=>{ b.textContent = MUTED?'🔇':'🔊'; };
  paint();
  b.onclick=(e)=>{ e.stopPropagation(); MUTED=!MUTED; localStorage.setItem('aj_muted',MUTED?'1':'0'); paint();
    if(MUTED){ stopMusic(); stopAllVoice(); }
    else { if(!AC)ac(); if(AC&&AC.state==='suspended')AC.resume(); startMusic(); S.tup(); } };
  document.body.appendChild(b);
}
// ---------- pause when tab hidden / window blurred (saves battery, avoids dt jumps) ----------
let HIDDEN=false;
document.addEventListener('visibilitychange', ()=>{ HIDDEN=document.hidden;
  if(HIDDEN){ stopMusic(); }
  else { last=performance.now(); if(AC&&AC.state==='suspended'&&!MUTED)AC.resume(); if(!MUTED&&G&&G.state)startMusic(); } });
window.addEventListener('blur', ()=>{ HIDDEN=true; });
window.addEventListener('focus', ()=>{ HIDDEN=false; last=performance.now(); });

// ---------- boot ----------
initAudioFiles();
const fontsReady = (document.fonts&&document.fonts.ready) ? document.fonts.ready.catch(()=>{}) : Promise.resolve();
Promise.all([
  load('bg','assets/kitchen-bg2.png'),     // gameplay-optimized kitchen (calm center, vignette)
  load('abuela','assets/abuela.png'),       // title/poster + fallback
  load('furia','assets/abuela-furia.png'),  // moneyshot poster art
  load('mzen','assets/m-zen.png'),          // reactive avatar busts
  load('mhappy','assets/m-happy.png'),
  load('mwatch','assets/m-watch.png'),
  load('mfuria','assets/m-furia.png'),
  fontsReady,
]).then(()=>{ buildStatics(); buildMuteBtn(); requestAnimationFrame(loop); });
document.getElementById('tapstart').addEventListener('click',()=>{ document.getElementById('tapstart').classList.add('hidden'); if(!AC)ac(); if(AC&&AC.state==='suspended')AC.resume(); startMusic(); newGame(); });
// allow keyboard restart
window.addEventListener('keydown',e=>{ if(e.key==='r'&&G){ closeOver&&document.getElementById('ov')&&closeOver(); newGame(); } });
