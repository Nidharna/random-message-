const API = 'https://api.gyanl.com/message-from-a-stranger?fields=message%2C%20sender-name%2Cdate';

const wrap = document.querySelector('.paper-wrap');
const plane = document.querySelector('.paper-plane');
const envelope = document.querySelector('.envelope');
const msgEl = document.querySelector('.msg');
const senderEl = document.querySelector('.sender');
const dateEl = document.querySelector('.date');
const newBtn = document.querySelector('.new-letter');
const confettiRoot = document.querySelector('.confetti');
const loadingOverlay = document.getElementById('loadingOverlay');

let prefetchedData = null;
const introOverlay = createIntro();
const caughtHint = createCaughtHint();

let flightAnimation = null;
let flightLoop = false;
let state = 'idle'; // idle, flying, caught, opened
let currentStranger = null;

let landed = false;

function formatDate(d){
  try{
    const dt = new Date(d);
    return dt.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
  }catch(e){
    return d;
  }
}

async function fetchMessage(){
  try{
    const res = await fetch(API,{cache:'no-store'});
    if(!res.ok) throw new Error('network');
    const data = await res.json();
    // API returns object with fields; adapt robustly
    const message = data.message || data['message'] || (data.data && data.data.message) || null;
    const sender = data['sender-name'] || data['sender_name'] || data.sender || data['sender'] || 'Someone';
    const date = data.date || data.sent || new Date().toISOString();
    return {message,sender,date};
  }catch(e){
    return fallbackMessage();
  }
}

function fallbackMessage(){
  const samples = [
    "I once learned that bravery looks like leaving the safe room.",
    "There is a soft place between dusk and sleep where secrets rest.",
    "I keep postcards from moments I almost told someone about.",
    "If you listen closely, even empty rooms have echoing stories."
  ];
  const names = ['Amelia','M. Rowan','Jules','E. Hart','An old friend'];
  const m = samples[Math.floor(Math.random()*samples.length)];
  const s = names[Math.floor(Math.random()*names.length)];
  const d = new Date(Date.now() - Math.floor(Math.random()*1000*60*60*24*365)).toISOString();
  return {message:m,sender:s,date:d};
}

async function revealNew(){
  // fetch and populate
  msgEl.textContent = '…';
  senderEl.textContent = '';
  dateEl.textContent = '';
  // use prefetched if available
  let data;
  if(prefetchedData){
    data = prefetchedData;
    prefetchedData = null;
  } else {
    showLoading();
    data = await fetchMessage();
    hideLoading();
  }
  msgEl.textContent = data.message || 'A quiet hello.';
  senderEl.textContent = data.sender || 'Someone';
  dateEl.textContent = formatDate(data.date || new Date().toISOString());
}

// when plane lands, reveal envelope
window.addEventListener('load',()=>{
  // after flight finishes give small delay then mark landed
  setTimeout(()=>{
    wrap.classList.add('landed');
    landed = true;
  }, 1600);

  // show initial loading while API warms and prefetch a message
  showLoading();
  const p = fetchMessage();
  // if api responds within 7s, hide; otherwise hide but keep waiting in background
  const timeout = new Promise(r=>setTimeout(r,7000,'timeout'));
  Promise.race([p, timeout]).then(async (res)=>{
    if(res === 'timeout'){
      // API still warming — hide overlay but keep prefetch running
      hideLoading();
      p.then(data=>{prefetchedData = data;}).catch(()=>{});
    } else {
      prefetchedData = await p;
      hideLoading();
    }
  }).catch(()=>{hideLoading();});
});

function showLoading(){if(loadingOverlay) loadingOverlay.classList.remove('hidden');}
function hideLoading(){if(loadingOverlay) loadingOverlay.classList.add('hidden');}

plane.addEventListener('click',async()=>{
  if(!landed) return;
  if(!envelope.classList.contains('unfold')){
    // if flying, catch it
    if(state === 'flying'){
      catchPlane();
      return;
    }
    // if already caught, open
    if(state === 'caught'){
      envelope.classList.add('unfold');
      await revealNew();
      launchConfetti();
      state = 'opened';
      caughtHint.classList.remove('show');
      return;
    }
  }
});

// support keyboard
plane.setAttribute('tabindex',0);
plane.addEventListener('keydown',(e)=>{if(e.key==='Enter' || e.key===' ') plane.click();});

newBtn.addEventListener('click',()=>{
  // reset a little: close, then reopen with another message
  envelope.classList.remove('unfold');
  msgEl.textContent = '';
  senderEl.textContent = '';
  dateEl.textContent = '';
  // subtle reenact flight: nudge plane then show envelope
  wrap.classList.remove('landed');
  plane.style.animation = 'flyIn 700ms cubic-bezier(.18,.9,.26,1) forwards';
  setTimeout(()=>{wrap.classList.add('landed'); plane.style.animation = ''; envelope.classList.add('unfold'); revealNew(); launchConfetti();},900);
});

function launchConfetti(){
  if(!confettiRoot) return;
  const colors = ['#FF6B6B','#FFD93D','#6BCB77','#4D96FF','#C77DFF'];
  const pieces = 24;
  for(let i=0;i<pieces;i++){
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.background = colors[Math.floor(Math.random()*colors.length)];
    el.style.left = (50 + (Math.random()*160-80)) + '%';
    el.style.top = (10 + Math.random()*10) + '%';
    el.style.width = (6 + Math.random()*10) + 'px';
    el.style.height = (8 + Math.random()*16) + 'px';
    el.style.borderRadius = (Math.random()*6|0) + 'px';
    const delay = Math.random()*300;
    const duration = 1200 + Math.random()*900;
    el.style.animation = `confettiFall ${duration}ms cubic-bezier(.18,.8,.34,1) ${delay}ms both`;
    confettiRoot.appendChild(el);
    setTimeout(()=>{el.remove();}, duration + delay + 200);
  }
}

/* ---------- Intro + Flight logic ---------- */
function createIntro(){
  const div = document.createElement('div');
  div.className = 'intro';
  div.innerHTML = `<div class="intro-inner"><h1>A stranger is trying to send you something…</h1><p>Sometimes letters find you when you least expect them.</p><button class="let-land">Let It Land ✈️</button></div>`;
  document.body.appendChild(div);
  const btn = div.querySelector('.let-land');
  btn.addEventListener('click',()=>{div.remove(); startFlight();});
  return div;
}

function createCaughtHint(){
  const el = document.createElement('div');
  el.className = 'caught-hint';
  el.textContent = 'You caught it. Now open it.';
  document.querySelector('.scene').appendChild(el);
  return el;
}

function startFlight(){
  state = 'flying';
  // ensure plane starts from random edge
  positionPlaneAtEdge();
  flightLoop = true;
  loopFlight();
  // after a short random time, have the plane approach the screen and show a preview
  const approachDelay = 1800 + Math.random()*2200;
  setTimeout(()=>{ if(state==='flying') approachAndPreview(); }, approachDelay);
}

function positionPlaneAtEdge(){
  // place offscreen randomly left/right/top
  const dir = Math.random() > 0.5 ? -1 : 1;
  plane.style.transition = 'none';
  plane.style.transform = `translate(${dir* -240}px, ${-120 + Math.random()*40}px) rotate(${dir * -14}deg)`;
}

function loopFlight(){
  if(!flightLoop) return;
  const scene = document.querySelector('.scene');
  const rect = scene.getBoundingClientRect();
  const keyframes = generateFlightKeyframes(rect);
  if(flightAnimation) flightAnimation.cancel();
  flightAnimation = plane.animate(keyframes, {duration: 2400 + Math.random()*1800, easing: 'cubic-bezier(.2,.8,.2,1)'});
  flightAnimation.onfinish = ()=>{ if(flightLoop) setTimeout(loopFlight, 100 + Math.random()*400); };
}

function generateFlightKeyframes(rect){
  // create a series of positions and rotations to simulate turns and loops
  const cx = rect.width/2;
  const cy = rect.height/2;
  const rand = ()=> (Math.random()*0.9 + 0.05);
  const points = [];
  for(let i=0;i<4;i++){
    const x = (Math.random()*rect.width);
    const y = (Math.random()*rect.height*0.7);
    const rot = (Math.random()*60 - 30);
    points.push({x,y,rot});
  }
  // build keyframes with percentage offsets
  const keyframes = points.map((p,i)=>{
    const offset = (i+1)/ (points.length+1);
    return { transform:`translate(${p.x - 24}px, ${p.y - 24}px) rotate(${p.rot}deg)` , offset };
  });
  // start from current transform
  keyframes.unshift({transform: getComputedStyle(plane).transform || 'translate(-220px,-120px) rotate(-12deg)', offset:0});
  keyframes.push({transform:`translate(${cx - 24}px, ${cy + 40}px) rotate(-6deg)`, offset:1});
  return keyframes;
}

function catchPlane(){
  // stop flight and land softly
  flightLoop = false;
  if(flightAnimation) flightAnimation.cancel();
  // animate to center landing
  const scene = document.querySelector('.scene');
  const rect = scene.getBoundingClientRect();
  const cx = rect.width/2 - 24;
  const cy = rect.height/2 + 30;
  plane.animate([{transform:getComputedStyle(plane).transform},{transform:`translate(${cx}px, ${cy}px) rotate(-8deg) scale(.95)`}],{duration:600,easing:'cubic-bezier(.2,.9,.26,1)',fill:'forwards'}).onfinish = ()=>{
    wrap.classList.add('landed');
    landed = true;
    state = 'caught';
    caughtHint.classList.add('show');
    hidePlanePreview();
  };
}

function approachAndPreview(){
  // stop looping and animate plane towards viewer (center & scale up)
  flightLoop = false;
  if(flightAnimation) flightAnimation.cancel();
  const scene = document.querySelector('.scene');
  const rect = scene.getBoundingClientRect();
  const cx = rect.width/2 - 24;
  const cy = rect.height/2 - 36;
  // animate plane moving in and scaling
  plane.animate([{transform:getComputedStyle(plane).transform},{transform:`translate(${cx}px, ${cy}px) rotate(-6deg) scale(1.5)`}],{duration:900,easing:'cubic-bezier(.2,.9,.26,1)',fill:'forwards'}).onfinish = ()=>{
    // show preview inside plane
    currentStranger = generateStranger();
    showPlanePreview(currentStranger.message);
    state = 'approaching';
  };
}

function showPlanePreview(text){
  const preview = document.querySelector('.plane-preview');
  const ptext = preview.querySelector('.preview-text');
  ptext.textContent = (text.length>70)? text.slice(0,66)+'…' : text;
  preview.classList.add('show');
}

function hidePlanePreview(){
  const preview = document.querySelector('.plane-preview');
  if(preview) preview.classList.remove('show');
}

/* ---------- Stranger generator ---------- */
function randomFrom(arr){return arr[Math.floor(Math.random()*arr.length)];}

function generateStranger(){
  const personalities = ['funny','mysterious','kind','dramatic','awkward','romantic','philosophical'];
  const personality = randomFrom(personalities);
  const names = ['Amelia','Rowan','Jules','Ezra','Marin','S. Kato','Nova','Finn','L. Hart'];
  const locations = ['a rainy rooftop','a sleepy coastal town','a crowded subway','a quiet library','a neon-lit kitchen','somewhere between trains'];
  const quirks = [
    'Currently slurping instant noodles at 2 AM. Claims no regrets.',
    'Collects single mismatched socks. Says they each tell a story.',
    'Writes questions in the margins of used books.',
    'Feeds pigeons when stressed. Swears they listen.',
  ];

  const messagesByPersonality = {
    funny:["If you ever lose a sock, check under your confidence.","I tried to write a secret but the cat read it."] ,
    mysterious:["There are doors you can only hear at midnight.","I left a paper boat on a river once; it circled back with a pebble."] ,
    kind:["Someone once held the umbrella for me. I still carry theirs in my pocket.","If you are tired, let your hands be a harbour."] ,
    dramatic:["I once told the sun to wait. It laughed and blushed.","The city kept my secret in neon letters."] ,
    awkward:["I rehearsed this sentence three times before folding it.","Sorry if this is forward; I'm very good at stalling."] ,
    romantic:["I learned the shape of your laugh in a cafe I will never return to.","There is a bridge where I left my courage; come find it."] ,
    philosophical:["We are all postcards from a future we haven't met.","Sometimes the question is the map, not the answer."]
  };

  // rare surprises
  const rare = Math.random() < 0.06; // 6% chance
  if(rare){
    const rareVariants = [
      {message:"Oops… I think this was meant for someone else 👀.",name:'Anonymous',location:'unknown',quirk:'Claims full responsibility for misplaced letters.'},
      {message:"Wrong address. But hello anyway.",name:'Postmistress',location:'the corner of Somewhere',quirk:'Writes wrong-address haikus.'},
      {message:"A whisper folded into a paper crane.",name:'—',location:'between pages',quirk:'Leaves marginalia for strangers.'}
    ];
    return Object.assign(randomFrom(rareVariants),{personality:'rare'});
  }

  const name = randomFrom(names);
  const message = randomFrom(messagesByPersonality[personality]);
  const location = randomFrom(locations);
  const quirk = randomFrom(quirks);
  const date = new Date(Date.now() - Math.floor(Math.random()*1000*60*60*24*180)).toISOString();
  return {message,name,location,quirk,personality,date};
}

/* ---------- Fill letter content ---------- */
async function revealNew(){
  msgEl.textContent = '…';
  senderEl.textContent = '';
  dateEl.textContent = '';
  const data = prefetchedData || await fetchMessage().catch(()=>fallbackMessage());
  // if data from API, adapt; otherwise use generated stranger
  let stranger;
  if(data && data.message && (data['sender-name'] || data.sender)){
    stranger = {message:data.message, name:data['sender-name']||data.sender, location: data.location || randomFrom(['somewhere nearby','a quiet corner']), quirk: 'Unknown', date: data.date||new Date().toISOString()};
  } else {
    const g = generateStranger();
    stranger = {message: g.message, name: g.name || g.sender || 'Someone', location: g.location, quirk: g.quirk, date: g.date};
  }
  // populate
  msgEl.textContent = stranger.message;
  senderEl.textContent = stranger.name;
  dateEl.textContent = formatDate(stranger.date);
  const loc = document.querySelector('.location'); if(loc) loc.textContent = stranger.location || '';
  const whoList = document.querySelector('.who-list');
  whoList.innerHTML = '';
  const items = [
    `Mood: ${randomFrom(['wistful','playful','sleepy','bold','thoughtful'])}`,
    `Favourite food: ${randomFrom(['noodles','cold pizza','honey toast','late-night dumplings','cereal'])}`,
    stranger.quirk || 'Has a small, secret hobby.'
  ];
  items.forEach(i=>{const li=document.createElement('li');li.textContent=i;whoList.appendChild(li)});
  prefetchedData = null;
}

/* ---------- Actions ---------- */
document.querySelector('.keep').addEventListener('click',()=>{
  alert('Saved to your little keepsakes.');
});
document.querySelector('.send-back').addEventListener('click',()=>{
  // fold and send back animation, then new one arrives
  envelope.classList.remove('unfold');
  setTimeout(()=>{sendAwayAndReturn();}, 420);
});
document.querySelectorAll('.new-letter').forEach(btn=>btn.addEventListener('click',()=>{
  envelope.classList.remove('unfold');
  setTimeout(()=>{sendAwayAndReturn();}, 420);
}));

function sendAwayAndReturn(){
  // fold into plane and animate dramatic fly-away, then new plane flies in
  state = 'flying';
  caughtHint.classList.remove('show');
  // animate plane from current to offscreen
  const rect = document.querySelector('.scene').getBoundingClientRect();
  const offX = Math.random()>0.5 ? rect.width + 200 : -300;
  plane.animate([{transform:getComputedStyle(plane).transform},{transform:`translate(${offX}px, -160px) rotate(-40deg) scale(.8)`}],{duration:900,easing:'cubic-bezier(.2,.9,.26,1)',fill:'forwards'}).onfinish = ()=>{
    // reset and start new flight after short delay
    setTimeout(()=>{wrap.classList.remove('landed'); landed=false; startFlight();}, 600);
  };
}
