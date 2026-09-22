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
let caughtHint = null;
let flightAnimation = null;
let flightLoop = false;
let state = 'intro';
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

function setLoading(show){
  if(!loadingOverlay) return;
  loadingOverlay.classList.toggle('hidden', !show);
}

function createIntro(){
  const div = document.createElement('div');
  div.className = 'intro';
  div.innerHTML = '<div class="intro-inner"><h1>A stranger is trying to send you something…</h1><p>Sometimes letters find you when you least expect them.</p><button class="let-land">Let It Land ✈️</button></div>';
  document.body.appendChild(div);
  const btn = div.querySelector('.let-land');
  btn.addEventListener('click', () => {
    div.remove();
    createCaughtHint();
    startFlight();
  });
  return div;
}

function createCaughtHint(){
  const el = document.createElement('div');
  el.className = 'caught-hint';
  el.textContent = 'You caught it. Now open it.';
  document.querySelector('.scene').appendChild(el);
  caughtHint = el;
}

function fallbackMessage(){
  const samples = [
    'I once learned that bravery looks like leaving the safe room.',
    'There is a soft place between dusk and sleep where secrets rest.',
    'I keep postcards from moments I almost told someone about.',
    'If you listen closely, even empty rooms have echoing stories.'
  ];
  const names = ['Amelia', 'M. Rowan', 'Jules', 'E. Hart', 'An old friend'];
  const message = randomFrom(samples);
  const sender = randomFrom(names);
  const date = new Date(Date.now() - Math.floor(Math.random() * 1000 * 60 * 60 * 24 * 365)).toISOString();
  return { message, sender, date };
}

async function fetchMessage(){
  try{
    const res = await fetch(API, { cache: 'no-store' });
    if(!res.ok) throw new Error('network');
    const data = await res.json();
    const message = data.message || data['message'] || (data.data && data.data.message) || null;
    const sender = data['sender-name'] || data['sender_name'] || data.sender || data['sender'] || 'Someone';
    const date = data.date || data.sent || new Date().toISOString();
    return { message, sender, date };
  }catch(e){
    return fallbackMessage();
  }
}

async function revealNew(){
  msgEl.textContent = '…';
  senderEl.textContent = '';
  dateEl.textContent = '';

  let stranger = currentStranger;
  if(!stranger){
    const data = prefetchedData || (await fetchMessage().catch(() => fallbackMessage()));
    if(data && (data['sender-name'] || data.sender || data.message)){
      stranger = {
        message: data.message || 'A quiet hello.',
        name: data['sender-name'] || data.sender || 'Someone',
        location: randomFrom(['a rainy rooftop', 'a sleepy coastal town', 'a quiet library', 'somewhere between trains']),
        quirk: 'Has a secret habit no one can quite explain.',
        date: data.date || new Date().toISOString()
      };
    } else {
      stranger = generateStranger();
    }
  }

  currentStranger = stranger;
  msgEl.textContent = stranger.message || 'A quiet hello.';
  senderEl.textContent = stranger.name || 'Someone';
  dateEl.textContent = formatDate(stranger.date || new Date().toISOString());

  const locEl = document.querySelector('.location');
  if(locEl) locEl.textContent = stranger.location || 'somewhere far away';

  const whoList = document.querySelector('.who-list');
  whoList.innerHTML = '';
  const items = [
    `Mood: ${randomFrom(['wistful', 'playful', 'sleepy', 'bold', 'thoughtful'])}`,
    `Favourite food: ${randomFrom(['noodles', 'cold pizza', 'honey toast', 'late-night dumplings', 'cereal'])}`,
    stranger.quirk || 'Has a small, secret hobby.'
  ];
  items.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    whoList.appendChild(li);
  });

  prefetchedData = null;
}

function randomFrom(arr){
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateStranger(){
  const personalities = ['funny', 'mysterious', 'kind', 'dramatic', 'awkward', 'romantic', 'philosophical'];
  const personality = randomFrom(personalities);
  const names = ['Amelia', 'Rowan', 'Jules', 'Ezra', 'Marin', 'S. Kato', 'Nova', 'Finn', 'L. Hart'];
  const locations = ['a rainy rooftop', 'a sleepy coastal town', 'a crowded subway', 'a quiet library', 'a neon-lit kitchen', 'somewhere between trains'];
  const quirks = [
    'Currently eating noodles at 2 AM. Claims they do not regret it.',
    'Collects single mismatched socks. Says each one has a story.',
    'Writes questions in the margins of used books.',
    'Feeds pigeons when stressed. Swears they listen back.'
  ];
  const messagesByPersonality = {
    funny: [
      'If you ever lose a sock, check under your confidence.',
      'I tried to write a secret but the cat read it and looked smug.'
    ],
    mysterious: [
      'There are doors you can only hear at midnight.',
      'I left a paper boat on a river once; it came back with a pebble.'
    ],
    kind: [
      'Someone once held the umbrella for me. I still carry that kindness around.',
      'If you are tired, let your hands be a harbour for a while.'
    ],
    dramatic: [
      'I once told the sun to wait. It laughed and went gold anyway.',
      'The city kept my secret in neon letters and rain.'
    ],
    awkward: [
      'I rehearsed this sentence three times before folding it.',
      'Sorry if this is forward. I am extremely good at stalling.'
    ],
    romantic: [
      'I learned the shape of your laugh in a cafe I never returned to.',
      'There is a bridge where I left my courage. Maybe you will find it.'
    ],
    philosophical: [
      'We are all postcards from a future we have not met yet.',
      'Sometimes the question is the map, not the answer.'
    ]
  };

  if(Math.random() < 0.08){
    const rareVariants = [
      { message: 'Oops… I think this was meant for someone else 👀.', name: 'Anonymous', location: 'unknown', quirk: 'Claims full responsibility for misplaced letters.' },
      { message: 'Wrong address. But hello anyway.', name: 'Postmistress', location: 'the corner of somewhere', quirk: 'Writes wrong-address haikus after midnight.' },
      { message: 'A whisper folded into a paper crane.', name: '—', location: 'between pages', quirk: 'Leaves notes for strangers in library books.' }
    ];
    const variant = randomFrom(rareVariants);
    variant.date = new Date(Date.now() - Math.floor(Math.random() * 1000 * 60 * 60 * 24 * 200)).toISOString();
    return variant;
  }

  const name = randomFrom(names);
  const message = randomFrom(messagesByPersonality[personality]);
  return {
    message,
    name,
    location: randomFrom(locations),
    quirk: randomFrom(quirks),
    date: new Date(Date.now() - Math.floor(Math.random() * 1000 * 60 * 60 * 24 * 180)).toISOString()
  };
}

function launchConfetti(){
  if(!confettiRoot) return;
  const colors = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#C77DFF'];
  for(let i = 0; i < 24; i++){
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.background = colors[Math.floor(Math.random() * colors.length)];
    el.style.left = (50 + (Math.random() * 160 - 80)) + '%';
    el.style.top = (10 + Math.random() * 10) + '%';
    el.style.width = (6 + Math.random() * 10) + 'px';
    el.style.height = (8 + Math.random() * 16) + 'px';
    el.style.borderRadius = (Math.random() * 6 | 0) + 'px';
    const delay = Math.random() * 300;
    const duration = 1200 + Math.random() * 900;
    el.style.animation = `confettiFall ${duration}ms cubic-bezier(.18,.8,.34,1) ${delay}ms both`;
    confettiRoot.appendChild(el);
    setTimeout(() => el.remove(), duration + delay + 200);
  }
}

function positionPlaneAtEdge(){
  const dir = Math.random() > 0.5 ? -1 : 1;
  plane.style.transition = 'none';
  plane.style.transform = `translate(${dir * -240}px, ${-120 + Math.random() * 40}px) rotate(${dir * -14}deg)`;
}

function loopFlight(){
  if(!flightLoop || state !== 'flying') return;
  const scene = document.querySelector('.scene');
  const rect = scene.getBoundingClientRect();
  const points = [];
  for(let i = 0; i < 4; i++){
    points.push({
      x: Math.random() * rect.width,
      y: Math.random() * rect.height * 0.7,
      rot: Math.random() * 60 - 30
    });
  }
  const keyframes = points.map((p, i) => ({
    transform: `translate(${p.x - 24}px, ${p.y - 24}px) rotate(${p.rot}deg)`,
    offset: (i + 1) / (points.length + 1)
  }));
  keyframes.unshift({ transform: getComputedStyle(plane).transform || 'translate(-220px,-120px) rotate(-12deg)', offset: 0 });
  keyframes.push({ transform: `translate(${rect.width / 2 - 24}px, ${rect.height / 2 + 40}px) rotate(-6deg)`, offset: 1 });

  if(flightAnimation) flightAnimation.cancel();
  flightAnimation = plane.animate(keyframes, {
    duration: 2200 + Math.random() * 1800,
    easing: 'cubic-bezier(.2,.8,.2,1)'
  });

  flightAnimation.onfinish = () => {
    if(flightLoop && state === 'flying') setTimeout(loopFlight, 100 + Math.random() * 400);
  };
}

function flyTowardUser(){
  flightLoop = false;
  if(flightAnimation) flightAnimation.cancel();

  const rect = document.querySelector('.scene').getBoundingClientRect();
  const cx = rect.width / 2 - 24;
  const cy = rect.height / 2 - 20;
  plane.animate([
    { transform: getComputedStyle(plane).transform || 'translate(-220px,-120px) rotate(-12deg)' },
    { transform: `translate(${cx}px, ${cy}px) rotate(-6deg) scale(1.5)` }
  ], {
    duration: 900,
    easing: 'cubic-bezier(.2,.9,.26,1)',
    fill: 'forwards'
  }).onfinish = () => {
    currentStranger = generateStranger();
    showPlanePreview(currentStranger.message);
    state = 'approaching';
  };
}

function showPlanePreview(text){
  const preview = document.querySelector('.plane-preview');
  const ptext = preview.querySelector('.preview-text');
  ptext.textContent = text.length > 70 ? text.slice(0, 66) + '…' : text;
  preview.classList.add('show');
}

function hidePlanePreview(){
  const preview = document.querySelector('.plane-preview');
  if(preview) preview.classList.remove('show');
}

function startFlight(){
  state = 'flying';
  landed = false;
  wrap.classList.remove('landed');
  envelope.classList.remove('unfold');
  hidePlanePreview();
  if(caughtHint) caughtHint.classList.remove('show');
  positionPlaneAtEdge();
  flightLoop = true;
  loopFlight();
  setTimeout(() => {
    if(state === 'flying') flyTowardUser();
  }, 1400 + Math.random() * 1800);
}

function catchPlane(){
  if(state !== 'flying' && state !== 'approaching') return;
  flightLoop = false;
  if(flightAnimation) flightAnimation.cancel();

  const rect = document.querySelector('.scene').getBoundingClientRect();
  const cx = rect.width / 2 - 24;
  const cy = rect.height / 2 + 20;
  plane.animate([
    { transform: getComputedStyle(plane).transform },
    { transform: `translate(${cx}px, ${cy}px) rotate(-8deg) scale(1)` }
  ], {
    duration: 650,
    easing: 'cubic-bezier(.2,.9,.26,1)',
    fill: 'forwards'
  }).onfinish = () => {
    landed = true;
    state = 'caught';
    wrap.classList.add('landed');
    hidePlanePreview();
    if(caughtHint) caughtHint.classList.add('show');
  };
}

async function openLetter(){
  if(state !== 'caught') return;
  if(!envelope.classList.contains('unfold')){
    envelope.classList.add('unfold');
    await revealNew();
    launchConfetti();
    state = 'opened';
    if(caughtHint) caughtHint.classList.remove('show');
  }
}

plane.addEventListener('click', () => {
  if(state === 'flying' || state === 'approaching'){
    catchPlane();
    return;
  }

  if(state === 'caught'){
    openLetter();
  }
});

plane.setAttribute('tabindex', 0);
plane.addEventListener('keydown', (e) => {
  if(e.key === 'Enter' || e.key === ' '){
    e.preventDefault();
    plane.click();
  }
});

function sendAwayAndReturn(){
  state = 'flying';
  caughtHint?.classList.remove('show');
  const rect = document.querySelector('.scene').getBoundingClientRect();
  const offX = Math.random() > 0.5 ? rect.width + 200 : -300;
  plane.animate([
    { transform: getComputedStyle(plane).transform },
    { transform: `translate(${offX}px, -160px) rotate(-40deg) scale(.8)` }
  ], {
    duration: 900,
    easing: 'cubic-bezier(.2,.9,.26,1)',
    fill: 'forwards'
  }).onfinish = () => {
    setTimeout(() => {
      wrap.classList.remove('landed');
      landed = false;
      envelope.classList.remove('unfold');
      hidePlanePreview();
      startFlight();
    }, 500);
  };
}

window.addEventListener('load', () => {
  createIntro();
  setLoading(true);
  fetchMessage().then((data) => {
    prefetchedData = data;
  }).catch(() => {
    prefetchedData = fallbackMessage();
  }).finally(() => {
    setTimeout(() => setLoading(false), 700);
  });
});

newBtn.addEventListener('click', () => {
  envelope.classList.remove('unfold');
  msgEl.textContent = '';
  senderEl.textContent = '';
  dateEl.textContent = '';
  sendAwayAndReturn();
});

document.querySelector('.keep').addEventListener('click', () => {
  alert('Saved to your little keepsakes.');
});

document.querySelector('.send-back').addEventListener('click', () => {
  envelope.classList.remove('unfold');
  setTimeout(sendAwayAndReturn, 420);
});
