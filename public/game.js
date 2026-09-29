const socket = io();
const $ = (id) => document.getElementById(id);
const cast = [
  { name: 'Blob', face: '●', color: '#72d5a0' }, { name: 'Bunny', face: '♟', color: '#ffb3ca' }, { name: 'Mushroom', face: '♣', color: '#f47e70' },
  { name: 'Cloud', face: '☁', color: '#a6d9ff' }, { name: 'Cat', face: '◆', color: '#e6bf7d' }, { name: 'Duck', face: '●', color: '#ffe16d' }, { name: 'Bear', face: '■', color: '#bb8b70' }
];
const TILE = 16;
const FIXED_STEP = 1 / 60;
const PIXEL_SCALE = 2;
const REMOTE_DELAY_MS = 100;
const SESSION_KEY = 'castle-dash-session';
function readSession() { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch (_) { return null; } }
function makeResumeToken() { const bytes = crypto.getRandomValues(new Uint8Array(24)); return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(''); }
const savedSession = readSession();
const state = { room: null, character: savedSession?.character || 'Blob', resumeToken: savedSession?.resumeToken || '', roomCode: savedSession?.roomCode || '', sound: true, audio: null, clue: null, levelIndex: -1, puzzleStep: -1, position: null, renderPosition: null, remoteTracks: new Map(), velocity: { x: 0, y: 0 }, facing: { x: 0, y: -1 }, keys: new Set(), moveVector: { x: 0, y: 0 }, joystickVector: { x: 0, y: 0 }, lastFrame: 0, accumulator: 0, stepDistance: 0, camera: { x: 0, y: 0 }, cameraReady: false, hintTarget: null, lastHint: null };
const screens = ['home', 'lobby', 'game'];
function showScreen(id) { screens.forEach((name) => $(name).classList.toggle('hidden', name !== id)); }
function esc(text) { const element = document.createElement('span'); element.textContent = text; return element.innerHTML; }
function characterMark(name) { return cast.find((item) => item.name === name) || cast[0]; }
function beep(kind = 'click') {
  if (!state.sound) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    state.audio ||= new AudioContextClass();
    const oscillator = state.audio.createOscillator(); const gain = state.audio.createGain();
    const notes = kind === 'win' ? [523, 659, 784] : kind === 'oops' || kind === 'hurt' ? [200, 130] : kind === 'step' ? [115] : [660];
    notes.forEach((frequency, index) => {
      const start = state.audio.currentTime + index * 0.09;
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.045, start); gain.gain.exponentialRampToValueAtTime(0.001, start + 0.075);
    });
    oscillator.connect(gain).connect(state.audio.destination); oscillator.start(); oscillator.stop(state.audio.currentTime + notes.length * 0.1);
  } catch (_) { /* Audio is optional. */ }
}
function selectedCharacter() { return state.character; }
function playerInfo() { return { name: $('playerName').value.trim() || savedSession?.name || 'Traveler', character: selectedCharacter() }; }
function playerPayload() {
  if (!state.resumeToken) state.resumeToken = makeResumeToken();
  return { ...playerInfo(), resumeToken: state.resumeToken };
}
function message(text) { $('homeMessage').textContent = text; }
function drawScene(canvas, progress = 0) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d'); const w = 240; const h = 150;
  canvas.width = w; canvas.height = h;
  const rect = (x, y, rw, rh, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, rw, rh); };
  rect(0, 0, w, h, '#7dbaf7'); rect(0, 78, w, 72, '#c9f5b7');
  rect(0, 57, 48, 32, '#dda8e6'); rect(20, 50, 45, 39, '#dda8e6'); rect(150, 58, 50, 31, '#dda8e6'); rect(175, 48, 45, 42, '#dda8e6');
  // Pixel steps soften mountain silhouettes without raster artwork.
  for (let i = 0; i < 10; i += 1) { rect(i * 5, 56 - i * 2, 6, 4, '#dda8e6'); rect(175 + i * 5, 54 - i * 2, 6, 4, '#dda8e6'); }
  rect(103, 52, 34, 38, '#fff0c8'); rect(110, 40, 20, 15, '#fff0c8'); rect(116, 31, 8, 13, '#fff0c8');
  rect(99, 48, 7, 26, '#fff0c8'); rect(134, 47, 7, 27, '#fff0c8');
  rect(100, 43, 7, 5, '#fa8dbd'); rect(134, 42, 7, 5, '#fa8dbd'); rect(117, 25, 7, 5, '#fa8dbd');
  rect(116, 68, 8, 22, '#7b594d'); rect(108, 58, 4, 6, '#665270'); rect(128, 58, 4, 6, '#665270');
  rect(0, 81, w, 3, '#54bd45');
  const scale = Math.min(1.7, 0.7 + progress * 0.16); const roadY = 84 + progress * 2;
  ctx.fillStyle = '#f5dca5'; ctx.beginPath(); ctx.moveTo(112, roadY); ctx.lineTo(128, roadY); ctx.lineTo(205, 150); ctx.lineTo(34, 150); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff0c8'; ctx.fillRect(112, roadY, 16, 3);
  ctx.lineWidth = 7; ctx.lineCap = 'square'; ctx.strokeStyle = '#f5dca5';
  [[120, 88, 91, 113], [120, 88, 120, 113], [120, 88, 149, 113]].forEach(([sx, sy, ex, ey]) => {
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
  });
  for (let x = 8; x < w; x += 23) { const y = 90 + (x % 4) * 9; rect(x, y, 3, 3, '#e95c59'); rect(x + 4, y - 3, 3, 3, '#e95c59'); rect(x + 15, y + 18, 5, 9, '#54bd45'); rect(x + 12, y + 14, 11, 5, '#85ed42'); }
  for (let x = 6; x < w; x += 13) rect(x, 84 + (x % 6), 5, 2, '#85ed42');
  const sunX = 207, sunY = 20; rect(sunX, sunY, 16, 16, '#ffdc58'); rect(sunX + 4, sunY + 5, 2, 2, '#302d45'); rect(sunX + 11, sunY + 5, 2, 2, '#302d45'); rect(sunX + 6, sunY + 11, 5, 2, '#e95c59');
  canvas.dataset.progress = progress;
}
function drawAll() { drawScene($('heroCanvas')); drawScene($('lobbyCanvas')); drawScene($('mapCanvas'), Math.max(0, (state.room?.round || 1) - 1)); }
function currentLevel() { return window.CASTLE_LEVELS[Math.max(0, state.levelIndex)]; }
function resizeMap() {
  const canvas = $('mapCanvas'); if (!canvas) return;
  const bounds = $('mapFrame').getBoundingClientRect();
  const width = Math.max(1, Math.floor(bounds.width / PIXEL_SCALE)); const height = Math.max(1, Math.floor(bounds.height / PIXEL_SCALE));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  const cssWidth = `${width * PIXEL_SCALE}px`, cssHeight = `${height * PIXEL_SCALE}px`;
  if (canvas.style.width !== cssWidth) canvas.style.width = cssWidth;
  if (canvas.style.height !== cssHeight) canvas.style.height = cssHeight;
}
function tileAt(level, x, y) { return level.tiles[y]?.[x] || '#'; }
function blocked(level, x, y) {
  const tile = tileAt(level, Math.floor(x), Math.floor(y));
  const progress = state.room?.progress || {};
  if (tile === '#' || tile === 'D' && !progress.gateOpen || tile === 'G' && !progress.gateOpen || tile === 'L' && !progress.codeOpen || tile === 'X' && !progress.bridgeOpen) return true;
  if (tile === '~' && level.id === 'bridge' && !progress.bridgeOpen) return true;
  return (state.room?.objects || []).some((object) => object.type === 'stone' && Math.floor(object.x) === Math.floor(x) && Math.floor(object.y) === Math.floor(y));
}
function collides(level, x, y) {
  const radius = .22;
  return blocked(level, x - radius, y - radius) || blocked(level, x + radius, y - radius)
    || blocked(level, x - radius, y + radius) || blocked(level, x + radius, y + radius);
}
function updateMovement(dt) {
  const level = currentLevel(); if (!state.renderPosition || !level) return;
  const inputX = (state.keys.has('d') || state.keys.has('arrowright') ? 1 : 0) - (state.keys.has('a') || state.keys.has('arrowleft') ? 1 : 0) + state.joystickVector.x;
  const inputY = (state.keys.has('s') || state.keys.has('arrowdown') ? 1 : 0) - (state.keys.has('w') || state.keys.has('arrowup') ? 1 : 0) + state.joystickVector.y;
  const magnitude = Math.hypot(inputX, inputY); const input = magnitude > 1 ? { x: inputX / magnitude, y: inputY / magnitude } : { x: inputX, y: inputY };
  const acceleration = 22, maxSpeed = 3.35, friction = 17;
  if (magnitude > .04) {
    state.velocity.x += input.x * acceleration * dt; state.velocity.y += input.y * acceleration * dt;
    state.facing = { x: input.x, y: input.y };
    const speed = Math.hypot(state.velocity.x, state.velocity.y);
    if (speed > maxSpeed) { state.velocity.x *= maxSpeed / speed; state.velocity.y *= maxSpeed / speed; }
  } else {
    const speed = Math.hypot(state.velocity.x, state.velocity.y);
    const nextSpeed = Math.max(0, speed - friction * dt);
    if (speed) { state.velocity.x *= nextSpeed / speed; state.velocity.y *= nextSpeed / speed; }
  }
  const travelX = state.velocity.x * dt, travelY = state.velocity.y * dt;
  const substeps = Math.max(1, Math.ceil(Math.max(Math.abs(travelX), Math.abs(travelY)) / .12));
  const stepX = travelX / substeps, stepY = travelY / substeps;
  for (let index = 0; index < substeps; index += 1) {
    const nextX = state.renderPosition.x + stepX;
    if (!collides(level, nextX, state.renderPosition.y)) state.renderPosition.x = nextX;
    else state.velocity.x = 0;
    const nextY = state.renderPosition.y + stepY;
    if (!collides(level, state.renderPosition.x, nextY)) state.renderPosition.y = nextY;
    else state.velocity.y = 0;
  }
  const walked = Math.hypot(travelX, travelY);
  if (walked) {
    state.stepDistance += walked;
    if (state.stepDistance >= .72) { state.stepDistance = 0; beep('step'); }
  }
  if (!magnitude && state.position) {
    state.renderPosition.x += (state.position.x - state.renderPosition.x) * Math.min(1, dt * 5);
    state.renderPosition.y += (state.position.y - state.renderPosition.y) * Math.min(1, dt * 5);
  }
}
function drawWorld(dt = FIXED_STEP) {
  const canvas = $('mapCanvas'); const level = currentLevel();
  if (!canvas || !level || !state.position) return;
  resizeMap();
  const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
  const width = canvas.width, height = canvas.height;
  const worldWidth = level.tiles[0].length * TILE, worldHeight = level.tiles.length * TILE;
  const playerPosition = state.renderPosition || state.position;
  const lookAhead = { x: state.velocity.x * 5, y: state.velocity.y * 5 };
  const targetX = Math.max(0, Math.min(Math.max(0, worldWidth - width), playerPosition.x * TILE - width / 2 + lookAhead.x));
  const targetY = Math.max(0, Math.min(Math.max(0, worldHeight - height), playerPosition.y * TILE - height / 2 + lookAhead.y));
  if (!state.cameraReady) { state.camera.x = targetX; state.camera.y = targetY; state.cameraReady = true; }
  const cameraEase = 1 - Math.exp(-9 * dt);
  state.camera.x += (targetX - state.camera.x) * cameraEase;
  state.camera.y += (targetY - state.camera.y) * cameraEase;
  const left = Math.floor(state.camera.x / TILE), top = Math.floor(state.camera.y / TILE);
  const right = Math.min(level.tiles[0].length, left + Math.ceil(width / TILE) + 2);
  const bottom = Math.min(level.tiles.length, top + Math.ceil(height / TILE) + 2);
  ctx.fillStyle = '#8ac7f8'; ctx.fillRect(0, 0, width, height);
  for (let y = top; y < bottom; y += 1) for (let x = left; x < right; x += 1) {
    const tile = tileAt(level, x, y); const sx = Math.floor(x * TILE - state.camera.x), sy = Math.floor(y * TILE - state.camera.y);
    ctx.fillStyle = (x + y) % 2 ? '#b8ed98' : '#b1e88d'; ctx.fillRect(sx, sy, TILE, TILE);
    const openedTile = (tile === 'D' || tile === 'G') && state.room?.progress?.gateOpen || tile === 'L' && state.room?.progress?.codeOpen || tile === 'X' && state.room?.progress?.bridgeOpen;
    if (tile === '=' || tile === '+' || tile === 'S' || tile === 'E' || openedTile) {
      ctx.fillStyle = '#edcf91'; ctx.fillRect(sx, sy + 1, TILE, TILE - 2); ctx.fillStyle = '#dbb97b'; ctx.fillRect(sx, sy, TILE, 2); ctx.fillRect(sx, sy + TILE - 2, TILE, 2);
    }
    if (tile === '#') { ctx.fillStyle = '#805b55'; ctx.fillRect(sx + 6, sy + 9, 5, 7); ctx.fillStyle = '#4d9f50'; ctx.fillRect(sx + 2, sy + 2, 12, 9); ctx.fillRect(sx + 4, sy, 8, 12); }
    if (tile === '~' && !(level.id === 'bridge' && state.room?.progress?.bridgeOpen)) { ctx.fillStyle = '#75c9df'; ctx.fillRect(sx, sy, TILE, TILE); ctx.fillStyle = '#b9f2e8'; ctx.fillRect(sx + 3, sy + 5, 7, 2); }
    if (tile === '!') { ctx.fillStyle = '#d8ad6b'; ctx.fillRect(sx, sy, TILE, TILE); ctx.fillStyle = '#f5dc4c'; ctx.fillRect(sx + 4, sy + 5, 8, 6); ctx.fillStyle = '#302d45'; ctx.fillRect(sx + 6, sy + 5, 2, 6); ctx.fillRect(sx + 10, sy + 5, 2, 6); }
    if (tile === 'C') { ctx.fillStyle = '#8b6047'; ctx.fillRect(sx + 7, sy + 7, 3, 9); ctx.fillStyle = '#fff1ca'; ctx.fillRect(sx + 2, sy + 2, 13, 7); ctx.fillStyle = '#df6687'; ctx.fillRect(sx + 5, sy + 4, 6, 2); }
    if (tile === 'B' || tile === 'T') { ctx.fillStyle = '#46964b'; ctx.fillRect(sx + 2, sy + 7, 12, 8); ctx.fillRect(sx + 4, sy + 4, 8, 9); if (tile === 'T') { ctx.fillStyle = '#ed6679'; ctx.fillRect(sx + 6, sy + 2, 5, 5); ctx.fillRect(sx + 8, sy + 7, 2, 7); } }
    if (tile === 'P') { ctx.fillStyle = '#d786ac'; ctx.fillRect(sx + 2, sy + 5, 12, 8); ctx.fillStyle = '#fff1ca'; ctx.fillRect(sx + 5, sy + 8, 6, 2); }
    if (tile === 'O') { ctx.fillStyle = '#897f85'; ctx.fillRect(sx + 3, sy + 5, 10, 9); ctx.fillStyle = '#bcb4b2'; ctx.fillRect(sx + 5, sy + 4, 6, 3); }
    if (tile === 'R') { ctx.fillStyle = '#9b6a49'; ctx.fillRect(sx + 2, sy + 5, 12, 7); ctx.fillStyle = '#e1b87a'; ctx.fillRect(sx + 4, sy + 7, 8, 1); }
    if (tile === 'X') { ctx.fillStyle = '#78cde1'; ctx.fillRect(sx, sy, TILE, TILE); ctx.fillStyle = '#a56d4c'; ctx.fillRect(sx + 1, sy + 5, 14, 8); ctx.fillStyle = '#e1b87a'; ctx.fillRect(sx + 3, sy + 7, 2, 5); ctx.fillRect(sx + 8, sy + 7, 2, 5); }
    if (tile === 'D' || tile === 'G' || tile === 'L') { ctx.fillStyle = '#f5d99e'; ctx.fillRect(sx + 2, sy + 2, 12, 14); ctx.fillStyle = '#8a6c7a'; ctx.fillRect(sx + 5, sy + 4, 7, 12); ctx.fillStyle = '#f2ca54'; ctx.fillRect(sx + 10, sy + 9, 2, 2); }
    if (tile === '+') { ctx.fillStyle = '#bd9464'; ctx.fillRect(sx + 6, sy + 4, 4, 4); }
  }
  drawWorldObjects(ctx, level, width, height);
  if (state.hintTarget) {
    const tx = Math.round(state.hintTarget.x * TILE - state.camera.x), ty = Math.round(state.hintTarget.y * TILE - state.camera.y - 16);
    const bob = Math.floor(Date.now() / 180) % 2 ? 2 : 0;
    ctx.fillStyle = '#fff4a0'; ctx.fillRect(tx - 5, ty - 13 + bob, 10, 9); ctx.fillStyle = '#e96883'; ctx.fillRect(tx - 2, ty - 4 + bob, 4, 8); ctx.fillRect(tx - 6, ty + 2 + bob, 12, 3);
  }
  const me = state.room?.players?.find((player) => player.id === socket.id);
  if (me) drawPlayer(ctx, playerPosition.x, playerPosition.y, me.name, me.character, width, height);
  const remoteTime = performance.now() - REMOTE_DELAY_MS;
  state.room?.players?.filter((player) => player.id !== socket.id && Number.isFinite(player.x) && Number.isFinite(player.y)).forEach((player) => {
    const position = interpolatedPosition(player, remoteTime);
    drawPlayer(ctx, position.x, position.y, player.name, player.character, width, height);
  });
}
function recordRemoteSnapshot(room) {
  const now = performance.now(); const active = new Set();
  room.players.forEach((player) => {
    if (player.id === socket.id || !Number.isFinite(player.x) || !Number.isFinite(player.y)) return;
    active.add(player.id);
    const samples = state.remoteTracks.get(player.id) || [];
    samples.push({ x: player.x, y: player.y, time: now });
    while (samples.length > 4) samples.shift();
    state.remoteTracks.set(player.id, samples);
  });
  for (const playerId of state.remoteTracks.keys()) if (!active.has(playerId)) state.remoteTracks.delete(playerId);
}
function interpolatedPosition(player, atTime) {
  const samples = state.remoteTracks.get(player.id);
  if (!samples?.length) return player;
  if (atTime <= samples[0].time) return samples[0];
  for (let index = 1; index < samples.length; index += 1) {
    const next = samples[index], previous = samples[index - 1];
    if (atTime <= next.time) {
      const amount = Math.max(0, Math.min(1, (atTime - previous.time) / (next.time - previous.time)));
      return { x: previous.x + (next.x - previous.x) * amount, y: previous.y + (next.y - previous.y) * amount };
    }
  }
  return samples[samples.length - 1];
}
function drawWorldObjects(ctx, level, width, height) {
  const live = new Map((state.room?.objects || []).map((object) => [object.id, object]));
  level.objects.forEach((definition) => {
    const object = live.get(definition.id); if (!object || !object.active || object.used && ['clue', 'trickster', 'symbol', 'plank', 'key'].includes(object.type)) return;
    const sx = Math.round(object.x * TILE - state.camera.x), sy = Math.round(object.y * TILE - state.camera.y);
    if (sx < -TILE || sy < -TILE || sx > width + TILE || sy > height + TILE) return;
    if (['clue', 'trickster', 'symbol', 'tutorial'].includes(object.type)) {
      ctx.fillStyle = '#8a6047'; ctx.fillRect(sx - 1, sy - 2, 3, 12); ctx.fillStyle = '#fff1c9'; ctx.fillRect(sx - 7, sy - 8, 15, 8);
      ctx.fillStyle = object.type === 'trickster' ? '#e86d8e' : '#76b854'; ctx.fillRect(sx - 3, sy - 6, 7, 3);
      if (object.type === 'tutorial') { ctx.fillStyle = '#302d45'; ctx.fillRect(sx - 3, sy - 3, 1, 1); ctx.fillRect(sx + 2, sy - 3, 1, 1); }
    } else if (object.type === 'plank') {
      ctx.fillStyle = '#9d704f'; ctx.fillRect(sx - 7, sy - 2, 14, 5); ctx.fillStyle = '#e5c183'; ctx.fillRect(sx - 5, sy - 1, 10, 1);
    } else if (object.type === 'bridge') {
      ctx.fillStyle = object.open ? '#54bd45' : '#9d704f'; ctx.fillRect(sx - 8, sy - 5, 16, 10); ctx.fillStyle = '#f2d397'; ctx.fillRect(sx - 5, sy - 3, 2, 7); ctx.fillRect(sx + 2, sy - 3, 2, 7);
    } else if (object.type === 'plate') {
      ctx.fillStyle = state.room?.progress?.plates?.[level.objects.filter((item) => item.type === 'plate').findIndex((item) => item.id === object.id)] ? '#85ed42' : '#d783a9'; ctx.fillRect(sx - 7, sy - 4, 14, 8); ctx.fillStyle = '#fff1c9'; ctx.fillRect(sx - 3, sy - 1, 6, 2);
    } else if (object.type === 'stone') {
      ctx.fillStyle = '#897f85'; ctx.fillRect(sx - 6, sy - 5, 12, 10); ctx.fillStyle = '#bcb4b2'; ctx.fillRect(sx - 3, sy - 6, 6, 3);
    } else if (object.type === 'lock') {
      ctx.fillStyle = '#f2d99c'; ctx.fillRect(sx - 7, sy - 8, 14, 15); ctx.fillStyle = '#7c6279'; ctx.fillRect(sx - 3, sy - 4, 6, 11); ctx.fillStyle = '#f4d55f'; ctx.fillRect(sx + 2, sy + 1, 2, 2);
    } else if (object.type === 'duck') {
      ctx.fillStyle = '#f4d25d'; ctx.fillRect(sx - 6, sy - 4, 11, 8); ctx.fillRect(sx + 2, sy - 7, 5, 5); ctx.fillStyle = '#ec875d'; ctx.fillRect(sx + 6, sy - 5, 4, 2);
    } else if (object.type === 'flag') {
      ctx.fillStyle = '#8b6047'; ctx.fillRect(sx - 1, sy - 8, 2, 16); ctx.fillStyle = '#ed6e9b'; ctx.fillRect(sx, sy - 8, 9, 5); ctx.fillStyle = '#fff1c9'; ctx.fillRect(sx + 2, sy - 7, 2, 2);
    } else if (object.type === 'key') {
      ctx.fillStyle = '#f4d45b'; ctx.fillRect(sx - 5, sy - 1, 10, 3); ctx.fillRect(sx - 6, sy - 4, 5, 8); ctx.fillRect(sx + 3, sy + 1, 2, 4); ctx.fillRect(sx + 6, sy + 1, 2, 3);
    } else if (object.type === 'gate') {
      ctx.fillStyle = object.open ? '#71bd67' : '#9b6f7f'; ctx.fillRect(sx - 8, sy - 7, 16, 12); ctx.fillStyle = '#fff1c9'; ctx.fillRect(sx - 5, sy - 5, 2, 9); ctx.fillRect(sx - 1, sy - 5, 2, 9); ctx.fillRect(sx + 3, sy - 5, 2, 9); ctx.fillStyle = '#f2ca54'; ctx.fillRect(sx + 5, sy - 1, 2, 2);
    }
    const sparkle = Math.floor(Date.now() / 300) % 2 === 0;
    if (!object.used && sparkle && ['tutorial', 'flag', 'key', 'gate', 'clue', 'trickster', 'symbol', 'plank', 'bridge'].includes(object.type)) {
      ctx.fillStyle = '#fff7bf'; ctx.fillRect(sx + 7, sy - 10, 3, 3); ctx.fillRect(sx - 10, sy - 5, 2, 2);
    }
    if (object.clouded) { ctx.fillStyle = '#ffffffdf'; ctx.fillRect(sx - 11, sy - 11, 22, 14); ctx.fillRect(sx - 7, sy - 14, 14, 5); }
  });
}
function drawPlayer(ctx, x, y, name, character, width, height) {
  const sx = Math.round(x * TILE - state.camera.x), sy = Math.round(y * TILE - state.camera.y);
  if (sx < -TILE || sy < -TILE || sx > width + TILE || sy > height + TILE) return;
  const mark = characterMark(character); const bob = state.moveVector.x || state.moveVector.y ? Math.floor(Date.now() / 100) % 2 : 0;
  ctx.fillStyle = '#302d45'; ctx.fillRect(sx - 5, sy + 5 + bob, 10, 8); ctx.fillStyle = mark.color; ctx.fillRect(sx - 5, sy + bob, 10, 10); ctx.fillRect(sx - 7, sy + 3 + bob, 3, 5); ctx.fillRect(sx + 4, sy + 3 + bob, 3, 5);
  ctx.fillStyle = '#fff'; ctx.fillRect(sx - 2, sy + 3 + bob, 2, 2); ctx.fillRect(sx + 2, sy + 3 + bob, 2, 2); ctx.fillStyle = '#302d45'; ctx.fillRect(sx - 1, sy + 4 + bob, 1, 1); ctx.fillRect(sx + 3, sy + 4 + bob, 1, 1);
  ctx.font = '6px sans-serif'; ctx.textAlign = 'center'; const label = String(name || 'Traveler'); const textWidth = ctx.measureText(label).width + 4;
  ctx.fillStyle = '#fff8dd'; ctx.fillRect(sx - textWidth / 2, sy - 8, textWidth, 7); ctx.fillStyle = '#302d45'; ctx.fillText(label, sx, sy - 2);
}
function animationFrame(now) {
  const frameDelta = Math.min(.1, (now - (state.lastFrame || now)) / 1000); state.lastFrame = now;
  state.accumulator += frameDelta;
  while (state.accumulator >= FIXED_STEP) {
    if (state.room?.status === 'PLAYING') updateMovement(FIXED_STEP);
    state.accumulator -= FIXED_STEP;
  }
  drawWorld(frameDelta || FIXED_STEP); requestAnimationFrame(animationFrame);
}
function buildCharacters() {
  const root = $('characterPicker');
  cast.forEach((person) => {
    const button = document.createElement('button'); button.className = 'character-choice'; button.title = person.name; button.setAttribute('aria-label', person.name);
    button.innerHTML = `${person.face}<small>${person.name.toUpperCase().slice(0, 3)}</small>`;
    button.addEventListener('click', () => { state.character = person.name; root.querySelectorAll('button').forEach((item) => item.classList.toggle('selected', item === button)); beep(); });
    if (person.name === state.character) button.classList.add('selected'); root.appendChild(button);
  });
  $('heroParty').innerHTML = cast.map((person) => `<span class="party-token" style="color:${person.color}">${person.face}</span>`).join('');
}
function renderLobby(room) {
  $('roomCodeDisplay').textContent = room.code;
  $('lobbyStatus').textContent = room.players.length === 7 ? 'The road is opening!' : `Waiting for travelers... ${room.players.length}/7`;
  $('playerList').innerHTML = room.players.map((player) => `<div class="player-row"><i style="color:${characterMark(player.character).color}">${characterMark(player.character).face}</i><span>${esc(player.name)}</span>${player.bot ? '<small>BOT</small>' : ''}</div>`).join('');
  $('startGameButton').classList.toggle('hidden', room.hostId !== socket.id || room.players.length < 1);
}
function renderGame(room) {
  $('roundNumber').textContent = state.levelIndex + 1;
  $('roundTitle').textContent = currentLevel().title;
  $('mapLabel').textContent = currentLevel().title.toUpperCase();
  $('hearts').textContent = `${'♥ '.repeat(room.hearts ?? 3).trim()}${'♡ '.repeat(Math.max(0, 3 - (room.hearts ?? 3))).trim()}`;
  $('hearts').setAttribute('aria-label', `${room.hearts ?? 3} shared hearts`);
  $('surprise').textContent = room.event || 'Explore the area and talk to anything that looks interesting.';
  $('objectiveLine').innerHTML = `<b>OBJECTIVE</b> ${esc(room.objective || 'Explore the room')}${room.progress.step > 0 ? ' ✓' : ''}`;
  $('hintStepLabel').textContent = `${Math.min(3, (room.hintLevels?.[room.puzzleStep] || 0) + 1)} / 3`;
  const me = room.players.find((player) => player.id === socket.id);
  $('clueCharacter').textContent = characterMark(me?.character).face;
  $('testTools').classList.toggle('hidden', !room.testMode);
  drawWorld();
}
function setClue(data) {
  state.clue = data;
  $('clueText').textContent = data.hidden ? 'A wandering cloud is hiding your clue!' : data.text;
  $('clueCharacter').textContent = characterMark(state.room?.players.find((player) => player.id === socket.id)?.character).face;
  if (!data.hidden && data.text) {
    const note = document.createElement('li'); note.textContent = data.text; $('clueLog').appendChild(note);
    $('emptyJournal').classList.add('hidden');
  }
}
function showHint(hint) {
  state.lastHint = hint; state.hintTarget = hint.target || null;
  $('hootTitle').textContent = hint.automatic ? 'HOOT CAME TO HELP' : `HOOT'S HINT ${hint.level} / 3`;
  $('hootText').textContent = hint.text; $('hootPanel').classList.remove('hidden');
  $('hintButton').classList.remove('pulse'); $('hintStepLabel').textContent = `${hint.level} / 3`;
  beep(hint.level === 3 ? 'win' : 'click');
}
function showToast(text) {
  const toast = $('gameToast'); toast.textContent = text; toast.classList.add('show');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => toast.classList.remove('show'), 2400);
}
function openCodePanel(data) {
  const options = `<option value="">?</option>${data.symbols.map((symbol) => `<option value="${esc(symbol)}">${esc(symbol)}</option>`).join('')}`;
  ['codeOne', 'codeTwo', 'codeThree'].forEach((id) => { $(id).innerHTML = options; });
  $('codePanel').classList.remove('hidden');
}
function render(room) {
  state.room = room;
  const meForSession = room.players.find((player) => player.id === socket.id);
  if (meForSession && state.resumeToken) {
    state.roomCode = room.code;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ roomCode: room.code, resumeToken: state.resumeToken, name: meForSession.name, character: meForSession.character }));
  }
  if (room.status === 'LOBBY') {
    state.levelIndex = -1; state.position = null; state.renderPosition = null; state.keys.clear(); state.moveVector = { x: 0, y: 0 };
    state.puzzleStep = -1; state.lastHint = null; state.hintTarget = null;
    $('hootPanel').classList.add('hidden'); $('journalPanel').classList.add('hidden');
    $('endOverlay').classList.add('hidden'); $('roomClearPanel').classList.add('hidden'); showScreen('lobby'); renderLobby(room); return;
  }
  $('backLobbyButton').classList.toggle('hidden', room.hostId !== socket.id);
  $('endBackLobby').classList.toggle('hidden', room.hostId !== socket.id);
  $('playAgain').classList.toggle('hidden', room.hostId !== socket.id);
  $('roomClearBack').classList.toggle('hidden', room.hostId !== socket.id);
  const nextLevel = Math.max(0, Math.min(window.CASTLE_LEVELS.length - 1, (room.round || 1) - 1));
  if (nextLevel !== state.levelIndex) {
    state.levelIndex = nextLevel;
    state.puzzleStep = -1; state.lastHint = null; state.hintTarget = null;
    state.position = { ...currentLevel().start };
    state.renderPosition = { ...currentLevel().start };
    state.velocity = { x: 0, y: 0 }; state.cameraReady = false; state.stepDistance = 0;
    $('clueLog').innerHTML = '';
    $('emptyJournal').classList.remove('hidden'); $('journalPanel').classList.add('hidden'); $('hootPanel').classList.add('hidden');
    $('clueText').textContent = 'Explore and interact with signs to find clues.';
  }
  if (room.puzzleStep !== state.puzzleStep) {
    state.puzzleStep = room.puzzleStep; state.lastHint = null; state.hintTarget = null;
    $('hootPanel').classList.add('hidden'); $('hintButton').classList.remove('pulse');
  }
  if (['WON', 'LOST'].includes(room.status)) {
    $('endStamp').textContent = room.status === 'WON' ? 'YOU MADE IT!' : 'BONK! TRY AGAIN';
    $('endText').textContent = room.status === 'WON' ? 'Seven travelers, one very surprised castle.' : 'The road got the better of you. The castle will still be there!';
    $('endOverlay').classList.remove('hidden'); beep(room.status === 'WON' ? 'win' : 'oops'); return;
  }
  if (room.status === 'ROOM_COMPLETE') {
    $('roomStarRating').textContent = `${Number(room.stars ?? 3).toFixed(1).replace('.0', '')} / 3 stars`;
    showScreen('game'); $('roomClearPanel').classList.remove('hidden'); $('endOverlay').classList.add('hidden'); return;
  }
  $('roomClearPanel').classList.add('hidden');
  const me = room.players.find((player) => player.id === socket.id);
  if (me && Number.isFinite(me.x) && Number.isFinite(me.y)) {
    state.position = { x: me.x, y: me.y };
    if (!state.renderPosition) state.renderPosition = { ...state.position };
  }
  showScreen('game'); $('endOverlay').classList.add('hidden'); renderGame(room);
  if (room.status === 'RESULT' && room.result) {
    $('resultStamp').textContent = room.result.correct ? 'HOORAY!' : 'BONK!';
    $('resultStamp').style.color = room.result.correct ? '#50a947' : '#e95c59';
    document.querySelector('.result-card').classList.toggle('oops', !room.result.correct);
    $('resultText').textContent = room.result.correct ? 'That is the way! The castle is closer.' : `Oops! ${room.result.choice} was a wrong turn. Splash! One heart gone.`;
    $('tricksterName').textContent = room.result.trickster;
    $('resultOverlay').classList.remove('hidden'); beep(room.result.correct ? 'win' : 'oops');
  } else $('resultOverlay').classList.add('hidden');
}
function updateClock() {
  if (!state.room?.deadline || state.room.status !== 'PLAYING') return;
  const left = Math.max(0, Math.ceil((state.room.deadline - Date.now()) / 1000)); $('timer').textContent = String(left).padStart(2, '0');
  $('timer').style.color = left <= 8 ? '#e95c59' : '';
}
function join(code) { window.castleTrack?.('room_join'); socket.emit('room:join', { ...playerPayload(), code }); }

if (savedSession?.name) $('playerName').value = savedSession.name;
buildCharacters(); drawAll();
$('createButton').addEventListener('click', () => { beep(); window.castleTrack?.('room_create'); socket.emit('room:create', playerPayload()); });
$('testButton').addEventListener('click', () => { beep(); window.castleTrack?.('test_mode_start'); socket.emit('room:test', playerPayload()); });
$('joinButton').addEventListener('click', () => { $('joinForm').classList.toggle('hidden'); $('roomCode').focus(); });
const inviteCode = new URLSearchParams(window.location.search).get('room');
if (inviteCode) {
  $('joinForm').classList.remove('hidden');
  $('roomCode').value = inviteCode.trim().toUpperCase();
  $('homeMessage').textContent = 'Room invite ready. Add your name, then join the adventure.';
}
$('submitJoin').addEventListener('click', () => { const value = $('roomCode').value.trim().toUpperCase(); if (value.length !== 4) return message('Room codes have four letters.'); join(value); });
$('roomCode').addEventListener('keydown', (event) => { if (event.key === 'Enter') $('submitJoin').click(); });
$('copyButton').addEventListener('click', async () => {
  const invite = new URL(window.location.origin);
  invite.searchParams.set('room', state.room.code);
  try { await navigator.clipboard.writeText(invite.href); $('lobbyStatus').textContent = 'Invite link copied! Send it to your friends.'; }
  catch (_) { $('lobbyStatus').textContent = invite.href; }
  beep();
});
$('startGameButton').addEventListener('click', () => socket.emit('game:start'));
$('backLobbyButton').addEventListener('click', () => socket.emit('game:back-to-lobby'));
$('endBackLobby').addEventListener('click', () => socket.emit('game:back-to-lobby'));
$('roomClearBack').addEventListener('click', () => socket.emit('game:back-to-lobby'));
$('testSkip').addEventListener('click', () => socket.emit('test:level', Number($('testLevel').value)));
$('hintButton').addEventListener('click', () => socket.emit('hint:request'));
$('closeHint').addEventListener('click', () => { $('hootPanel').classList.add('hidden'); state.hintTarget = null; });
$('replayHint').addEventListener('click', () => { if (state.lastHint) showHint(state.lastHint); });
$('journalButton').addEventListener('click', () => $('journalPanel').classList.toggle('hidden'));
$('closeJournal').addEventListener('click', () => $('journalPanel').classList.add('hidden'));
$('helpObjectButton').addEventListener('click', () => socket.emit('player:help'));
function refreshMoveVector() {
  const x = (state.keys.has('d') || state.keys.has('arrowright') ? 1 : 0) - (state.keys.has('a') || state.keys.has('arrowleft') ? 1 : 0);
  const y = (state.keys.has('s') || state.keys.has('arrowdown') ? 1 : 0) - (state.keys.has('w') || state.keys.has('arrowup') ? 1 : 0);
  state.moveVector = { x, y };
}
function interactLocal() {
  if (state.room?.status !== 'PLAYING') return;
  socket.emit('player:action'); beep('click');
}
window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'e'].includes(key)) event.preventDefault();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) { state.keys.add(key); refreshMoveVector(); }
  if ((key === ' ' || key === 'e') && !event.repeat && state.room?.status === 'PLAYING') interactLocal();
});
window.addEventListener('keyup', (event) => { state.keys.delete(event.key.toLowerCase()); refreshMoveVector(); });
$('actionButton').addEventListener('pointerdown', (event) => { event.preventDefault(); interactLocal(); });
const joystick = $('joystick'), joystickKnob = $('joystickKnob');
function joystickMove(event) {
  const rect = joystick.getBoundingClientRect(); const radius = rect.width * .34;
  const dx = event.clientX - (rect.left + rect.width / 2), dy = event.clientY - (rect.top + rect.height / 2);
  const length = Math.max(1, Math.hypot(dx, dy)); const scale = Math.min(1, radius / length);
  state.joystickVector = { x: dx / length * scale, y: dy / length * scale };
  joystickKnob.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
}
joystick.addEventListener('pointerdown', (event) => { joystick.setPointerCapture(event.pointerId); joystickMove(event); });
joystick.addEventListener('pointermove', (event) => { if (joystick.hasPointerCapture(event.pointerId)) joystickMove(event); });
function resetJoystick() { if (!joystick) return; state.joystickVector = { x: 0, y: 0 }; joystickKnob.style.transform = 'translate(0, 0)'; }
joystick.addEventListener('pointerup', resetJoystick); joystick.addEventListener('pointercancel', resetJoystick);
$('muteButton').addEventListener('click', () => { state.sound = !state.sound; $('muteButton').textContent = state.sound ? '♪' : '×'; $('muteButton').setAttribute('aria-label', state.sound ? 'Mute sound' : 'Enable sound'); if (state.sound) beep(); });
$('playAgain').addEventListener('click', () => socket.emit('game:restart'));
$('submitCode').addEventListener('click', () => {
  socket.emit('gate:submit', [$('codeOne').value, $('codeTwo').value, $('codeThree').value]);
  $('codePanel').classList.add('hidden');
});
$('closeCode').addEventListener('click', () => $('codePanel').classList.add('hidden'));
$('codePanel').addEventListener('click', (event) => { if (event.target === $('codePanel')) $('codePanel').classList.add('hidden'); });
socket.on('connect', () => {
  if (state.roomCode && state.resumeToken) {
    message('Reconnecting to your room...');
    socket.emit('room:resume', { code: state.roomCode, token: state.resumeToken });
  } else message('Connected! Find six friends, or bring six very agreeable bots.');
});
socket.on('room:state', (room) => { recordRemoteSnapshot(room); render(room); if (room.status === 'PLAYING' && !state.clue) $('clueText').textContent = 'Your clue is on its way...'; });
socket.on('clue:private', setClue);
socket.on('room:error', (text) => message(text));
socket.on('room:resume-error', () => {
  sessionStorage.removeItem(SESSION_KEY); state.roomCode = ''; state.resumeToken = '';
  message('That room has expired. Create a new room or join with a fresh code.');
});
socket.on('disconnect', () => message('Connection lost. Trying to reconnect...'));
socket.on('clue:found', setClue);
socket.on('game:toast', showToast);
socket.on('hint:shared', showHint);
socket.on('hint:auto-warning', () => { $('hintButton').classList.add('pulse'); $('hootTitle').textContent = 'HOOT IS CHECKING IN'; $('hootText').textContent = 'Stuck? Tap the lightbulb for a hint!'; $('hootPanel').classList.remove('hidden'); });
socket.on('code:open', openCodePanel);
socket.on('game:hurt', () => { $('mapFrame').classList.remove('hurt'); void $('mapFrame').offsetWidth; $('mapFrame').classList.add('hurt'); beep('hurt'); setTimeout(() => $('mapFrame').classList.remove('hurt'), 500); });
socket.on('game:area-clear', ({ trickster }) => {
  $('mapFrame').classList.add('pixel-wipe'); beep('win');
  if (trickster) showToast(`GOTCHA! ${trickster} found the trickster sign!`);
  setTimeout(() => $('mapFrame').classList.remove('pixel-wipe'), 850);
});
setInterval(updateClock, 150);
setInterval(() => {
  if (state.room?.status === 'PLAYING' && state.renderPosition) socket.emit('player:position', { ...state.renderPosition, facing: state.facing });
}, 67);
function clearMovementInput() {
  state.keys.clear(); state.moveVector = { x: 0, y: 0 }; state.joystickVector = { x: 0, y: 0 };
  state.velocity = { x: 0, y: 0 };
  if (state.position && state.renderPosition) state.renderPosition = { ...state.position };
  if (joystickKnob) joystickKnob.style.transform = 'translate(0, 0)';
}
window.addEventListener('blur', clearMovementInput);
document.addEventListener('visibilitychange', () => { if (document.hidden) clearMovementInput(); });
window.addEventListener('resize', () => { drawAll(); resizeMap(); });
requestAnimationFrame(animationFrame);