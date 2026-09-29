const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const LEVELS = require('./public/levels');
const MAX_PLAYERS = 7;
const WALK_SPEED = 3.6;
const AREA_TIME_MS = 30000;
const RESUME_GRACE_MS = 120000;
const CHARACTERS = ['Blob', 'Bunny', 'Mushroom', 'Cloud', 'Cat', 'Duck', 'Bear'];
const rooms = new Map();
const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static(path.join(__dirname, 'public')));

function code() {
  let value;
  do value = Math.random().toString(36).slice(2, 6).toUpperCase(); while (rooms.has(value));
  return value;
}
function roomFor(socket) { return rooms.get(socket.data.roomCode); }
function view(room) {
  const step = room.level?.puzzleSteps?.[room.progress.step];
  return { code: room.code, hostId: room.hostId, status: room.status, players: room.players.map(({ id, name, character, bot, x, y, facing, hurtUntil, connected }) => ({ id, name, character, bot, x, y, facing, hurtUntil, connected })), round: room.levelIndex + 1, levelIndex: room.levelIndex, hearts: room.hearts, deadline: room.deadline, title: room.level?.title, objective: step?.objective || 'Walk through the open gate', puzzleStep: room.progress.step, hintLevels: room.hintLevels, hintPenalty: room.hintPenalty || 0, stars: room.stars ?? 3, event: room.event, progress: room.progress, objects: room.objects?.map(({ id, type, x, y, used, active, open }) => ({ id, type, x, y, used, active, open, clouded: id === room.cloudedId && Date.now() < room.cloudedUntil })), testMode: room.testMode };
}
function sendRoom(room) { io.to(room.code).emit('room:state', view(room)); }
function addPlayer(room, player) {
  if (room.players.length >= MAX_PLAYERS) throw new Error('This room already has 7 travelers.');
  if (room.players.some((item) => item.name.toLowerCase() === player.name.toLowerCase())) throw new Error('That name is already in this room.');
  room.players.push(player);
}
function beginLevel(room, levelIndex = 0) {
  room.levelIndex = Math.max(0, Math.min(LEVELS.length - 1, levelIndex));
  room.level = LEVELS[room.levelIndex];
  room.status = 'PLAYING';
  room.deadline = Date.now() + AREA_TIME_MS;
  room.progress = { step: 0, key: false, planks: 0, bridgeOpen: false, gateOpen: false, codeOpen: false };
  room.hintLevels = [];
  room.hintPenalty = 0;
  room.lastProgressAt = Date.now(); room.autoHelpStage = 0;
  room.tricksterId = null;
  room.cloudedId = null; room.cloudedUntil = 0;
  room.foundClues = [];
  room.objects = room.level.objects.map(({ id, type, x, y }) => ({ id, type, x, y, used: false, active: true, open: false }));
  const clueObjects = room.objects.filter((object) => ['clue', 'trickster', 'symbol'].includes(object.type));
  if (room.level.id === 'courtyard') {
    room.event = room.level.story;
  } else if (Math.random() < 0.5 && clueObjects.length) {
    room.cloudedId = clueObjects[Math.floor(Math.random() * clueObjects.length)].id;
    room.cloudedUntil = Date.now() + 7000;
    room.event = 'A wandering cloud will hide one sign for a few seconds!';
  } else {
    const x = Math.max(1.5, Math.min(room.level.tiles[0].length - 2.5, room.level.exit.x - 1));
    room.objects.push({ id: 'event-duck', type: 'duck', x, y: room.level.exit.y, used: false, active: true, open: false });
    room.event = 'A chatty duck is blocking the way. Go say hello!';
  }
  room.players.forEach((player) => {
    player.x = room.level.start.x; player.y = room.level.start.y;
    player.facing = { x: 0, y: -1 }; player.hurtUntil = 0; player.lastMoveAt = Date.now(); player.clues = []; player.lastClue = null;
  });
  sendRoom(room);
}
function createRoom() { const room = { code: code(), hostId: null, hostResumeToken: null, status: 'LOBBY', players: [], levelIndex: 0, level: null, hearts: 3, deadline: null, progress: {}, objects: [], testMode: false, event: '' }; rooms.set(room.code, room); return room; }
function assignSeat(room, socket, name, character, resumeToken) {
  const player = { id: socket.id, resumeToken: String(resumeToken || ''), name: String(name || 'Traveler').trim().slice(0, 14) || 'Traveler', character: CHARACTERS.includes(character) ? character : 'Blob', bot: false, connected: true, x: 0, y: 0, facing: { x: 0, y: -1 }, hurtUntil: 0, lastMoveAt: Date.now(), clues: [] };
  if (player.resumeToken.length < 24) throw new Error('Refresh and try again to create a secure room session.');
  addPlayer(room, player);
  if (!room.hostId) { room.hostId = socket.id; room.hostResumeToken = player.resumeToken; }
  socket.data.roomCode = room.code;
  socket.join(room.code);
  sendRoom(room);
  if (room.players.length === MAX_PLAYERS) beginLevel(room);
}

function solidAt(room, x, y) {
  const tile = room.level.tiles[Math.floor(y)]?.[Math.floor(x)] || '#';
  if (tile === '#' || tile === 'D' && !room.progress.gateOpen || tile === 'G' && !room.progress.gateOpen || tile === 'L' && !room.progress.codeOpen || tile === 'X' && !room.progress.bridgeOpen) return true;
  if (tile === '~' && room.level.id === 'bridge' && !room.progress.bridgeOpen) return true;
  if (room.objects.some((object) => object.type === 'duck' && object.active && Math.hypot(object.x - x, object.y - y) < .5)) return true;
  return room.objects.some((object) => object.type === 'stone' && Math.floor(object.x) === Math.floor(x) && Math.floor(object.y) === Math.floor(y));
}
function applyPosition(room, player, requested) {
  if (!Number.isFinite(requested?.x) || !Number.isFinite(requested?.y)) return;
  const now = Date.now(); const elapsed = Math.max(0.05, Math.min(0.25, (now - player.lastMoveAt) / 1000));
  player.lastMoveAt = now;
  let dx = requested.x - player.x, dy = requested.y - player.y;
  const distance = Math.hypot(dx, dy), maxDistance = WALK_SPEED * elapsed + 0.12;
  if (distance > maxDistance) { dx = dx / distance * maxDistance; dy = dy / distance * maxDistance; }
  const nextX = player.x + dx, nextY = player.y + dy;
  if (!solidAt(room, nextX, player.y)) player.x = nextX;
  if (!solidAt(room, player.x, nextY)) player.y = nextY;
  if (requested.facing && Number.isFinite(requested.facing.x) && Number.isFinite(requested.facing.y)) player.facing = requested.facing;
}
function sendToast(player, text) { io.to(player.id).emit('game:toast', text); }
function progressFor(room, type) { return room.level.objects.find((object) => object.type === type); }
function interact(room, player) {
  const object = room.objects.filter((item) => item.active && Math.hypot(item.x - player.x, item.y - player.y) <= 1.35).sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y))[0];
  if (!object) return sendToast(player, 'Nothing close by. Try a sign, bush, stone or statue.');
  if (object.id === room.cloudedId && Date.now() < room.cloudedUntil) return sendToast(player, 'A wandering cloud is covering this clue!');
  const definition = room.level.objects.find((item) => item.id === object.id);
  if (object.type === 'clue' || object.type === 'trickster' || object.type === 'symbol') {
    if (object.used) return sendToast(player, 'This sign has already shared its secret.');
    object.used = true;
    let clue = definition?.clue || 'The sign has no words today.';
    if (object.type === 'trickster') {
      if (room.players.length >= 3) room.tricksterId = player.id;
      else clue = definition?.truth || clue;
    }
    player.clues.push(clue); room.foundClues.push(object.id);
    player.lastClue = { text: clue, kind: object.type };
    io.to(player.id).emit('clue:found', player.lastClue);
    sendRoom(room); return;
  }
  if (object.type === 'tutorial') {
    if (room.progress.step === 0) {
      room.progress.step = 1; room.lastProgressAt = Date.now(); room.autoHelpStage = 0;
      player.clues.push(definition.clue); player.lastClue = { text: definition.clue, kind: 'tutorial' }; io.to(player.id).emit('clue:found', player.lastClue);
      io.to(room.code).emit('game:toast', 'The signpost says: Welcome, brave wanderer!');
      sendRoom(room);
    } else sendToast(player, definition.clue);
    return;
  }
  if (object.type === 'flag') { sendToast(player, 'The pink flag flaps right above something shiny.'); return; }
  if (object.type === 'key') {
    if (room.progress.step < 1) return sendToast(player, 'The signpost might explain what to look for.');
    if (room.progress.key) return sendToast(player, 'You already have the little courtyard key.');
    object.used = true; room.progress.key = true; room.progress.step = 2;
    room.lastProgressAt = Date.now(); room.autoHelpStage = 0;
    player.clues.push('Key: a small golden key from beneath the pink flag.');
    player.lastClue = { text: 'You found the key under the pink flag!', kind: 'item' };
    io.to(player.id).emit('clue:found', player.lastClue);
    io.to(room.code).emit('game:toast', `${player.name} found the courtyard key!`); sendRoom(room); return;
  }
  if (object.type === 'gate') {
    if (!room.progress.key) return sendToast(player, 'The gate is locked. Find the key beneath the pink flag.');
    if (!room.progress.gateOpen) {
      room.progress.gateOpen = true; room.progress.step = 3;
      room.lastProgressAt = Date.now(); room.autoHelpStage = 0;
      io.to(room.code).emit('game:toast', 'The key turns! The gate swings open with a squeaky creak.');
      sendRoom(room);
    } else sendToast(player, 'The gate is open. Head through!');
    return;
  }
  if (object.type === 'search') {
    if (object.used) return sendToast(player, 'Someone already checked this spot.');
    object.used = true;
    if (definition?.correct && !room.progress.key) { room.progress.key = true; sendToast(player, 'A tiny key! The forest gate is open.'); }
    else sendToast(player, definition?.clue || 'Just leaves.');
    sendRoom(room); return;
  }
  if (object.type === 'plank') {
    if (object.used) return sendToast(player, 'That plank has been picked up.');
    object.used = true; room.progress.planks += 1;
    sendToast(player, `Plank found! ${room.progress.planks}/3 collected.`); sendRoom(room); return;
  }
  if (object.type === 'bridge') {
    if (room.progress.planks < 3) return sendToast(player, `The bridge needs ${3 - room.progress.planks} more plank(s).`);
    room.progress.bridgeOpen = true; object.open = true; sendToast(player, 'The bridge is fixed. Wobbly but walkable!'); sendRoom(room); return;
  }
  if (object.type === 'stone') {
    let dx = Math.sign(player.facing.x), dy = Math.sign(player.facing.y);
    if (Math.abs(player.facing.x) > Math.abs(player.facing.y)) dy = 0; else dx = 0;
    if (!dx && !dy) dy = -1;
    const nextX = object.x + dx, nextY = object.y + dy;
    if (solidAt(room, nextX, nextY) || room.players.some((person) => person.id !== player.id && Math.floor(person.x) === Math.floor(nextX) && Math.floor(person.y) === Math.floor(nextY))) return sendToast(player, 'That stone will not budge that way.');
    object.x = nextX; object.y = nextY; sendRoom(room); return;
  }
  if (object.type === 'plate') return sendToast(player, 'Stand on all three plates together. Stones can hold them down.');
  if (object.type === 'lock') return io.to(player.id).emit('code:open', { symbols: ['SUN', 'MOON', 'STAR', 'FLOWER', 'TULIP', 'CLOUD'] });
  if (object.type === 'duck') {
    object.active = false; room.event = 'The duck quacks and waddles out of the way!';
    io.to(room.code).emit('game:toast', room.event); sendRoom(room); return;
  }
  sendToast(player, 'A tiny secret, tucked away.');
}
function gateReady(room) {
  const plates = room.level.objects.filter((object) => object.type === 'plate');
  const held = plates.map((plate) => room.players.some((player) => Math.hypot(player.x - plate.x, player.y - plate.y) < .48) || room.objects.some((object) => object.type === 'stone' && Math.hypot(object.x - plate.x, object.y - plate.y) < .48));
  room.progress.plates = held;
  const opened = held.length === 3 && held.every(Boolean);
  if (opened && !room.progress.gateOpen) room.event = 'Click! The garden gate swings open!';
  room.progress.gateOpen = opened;
}
function areaReady(room) {
  if (room.level.id === 'courtyard') return room.progress.step >= 3;
  if (room.level.id === 'forest') return room.progress.key;
  if (room.level.id === 'bridge') return room.progress.bridgeOpen;
  if (room.level.id === 'garden') return room.progress.gateOpen;
  if (room.level.id === 'castle') return room.progress.codeOpen;
  return true;
}
function finishArea(room) {
  if (room.status !== 'PLAYING') return;
  if (room.level.id === 'courtyard') {
    room.stars = Math.max(0, 3 - room.hintPenalty);
    room.status = 'ROOM_COMPLETE'; room.event = 'Courtyard clear! The rest of the castle is waiting for your review.';
    io.to(room.code).emit('game:area-clear', { levelIndex: room.levelIndex, trickster: null });
    sendRoom(room); return;
  }
  room.status = 'LEVEL_COMPLETE'; room.event = 'Area clear! The castle gets closer!';
  const trickster = room.tricksterId && room.players.find((player) => player.id === room.tricksterId);
  io.to(room.code).emit('game:area-clear', { levelIndex: room.levelIndex, trickster: trickster?.name || null });
  sendRoom(room);
  setTimeout(() => {
    if (room.status !== 'LEVEL_COMPLETE') return;
    if (room.levelIndex === LEVELS.length - 1) { room.status = 'WON'; sendRoom(room); }
    else beginLevel(room, room.levelIndex + 1);
  }, 1800);
}
function checkAreaExit(room, player) {
  if (Math.hypot(player.x - room.level.exit.x, player.y - room.level.exit.y) > .7) return;
  if (room.objects.some((object) => object.type === 'duck' && object.active)) return sendToast(player, 'The duck is blocking the path. Talk to it first!');
  if (!areaReady(room)) {
    const hints = { forest: 'Find the key under a bush or tulip.', bridge: 'Collect three planks and repair the bridge.', garden: 'Hold all three plates down together.', castle: 'Find the symbols and enter the three-part code.' };
    if (Date.now() - (player.lastHintAt || 0) > 1500) { player.lastHintAt = Date.now(); sendToast(player, hints[room.level.id]); }
    return;
  }
  finishArea(room);
}
function shareHint(room, automatic) {
  const steps = room.level?.puzzleSteps;
  if (!steps?.length) return;
  const stepIndex = Math.min(room.progress.step, steps.length - 1);
  const step = steps[stepIndex];
  const currentLevel = room.hintLevels[stepIndex] || 0;
  if (automatic && currentLevel > 0) return;
  const hintLevel = automatic ? 1 : Math.min(3, currentLevel + 1);
  room.hintLevels[stepIndex] = hintLevel;
  if (!automatic && hintLevel === 2) room.hintPenalty += .5;
  if (!automatic && hintLevel === 3) room.hintPenalty += 1;
  const targetObject = room.objects.find((object) => object.id === step.target);
  io.to(room.code).emit('hint:shared', {
    step: stepIndex, level: hintLevel, text: step.hints[hintLevel - 1],
    target: hintLevel > 1 && targetObject ? { x: targetObject.x, y: targetObject.y } : null,
    automatic: Boolean(automatic)
  });
}
function returnToLobby(room) {
  room.status = 'LOBBY'; room.level = null; room.levelIndex = 0; room.deadline = null;
  room.pausedAt = null;
  room.hearts = 3; room.progress = {}; room.objects = []; room.event = 'Back at the glade. Ready when you are!';
  room.players.forEach((player) => { player.x = 0; player.y = 0; player.hurtUntil = 0; });
  sendRoom(room);
}

io.on('connection', (socket) => {
  socket.on('room:resume', ({ code: roomCode, token } = {}) => {
    const room = rooms.get(String(roomCode || '').toUpperCase());
    const player = room?.players.find((item) => item.resumeToken === token);
    if (!room || !player) return socket.emit('room:resume-error');
    if (room.pausedAt) { room.deadline += Date.now() - room.pausedAt; room.pausedAt = null; }
    player.id = socket.id; player.connected = true; player.disconnectedAt = null; player.lastMoveAt = Date.now();
    if (room.hostResumeToken === token || !room.players.some((item) => item.id === room.hostId && item.connected)) room.hostId = socket.id;
    socket.data.roomCode = room.code; socket.join(room.code); sendRoom(room);
    if (player.lastClue) socket.emit('clue:found', player.lastClue);
  });
  socket.on('room:create', ({ name, character, resumeToken } = {}) => {
    const room = createRoom();
    try { assignSeat(room, socket, name, character, resumeToken); } catch (error) { rooms.delete(room.code); socket.emit('room:error', error.message); }
  });
  socket.on('room:join', ({ code: roomCode, name, character, resumeToken } = {}) => {
    const room = rooms.get(String(roomCode || '').toUpperCase());
    if (!room || room.status !== 'LOBBY') return socket.emit('room:error', 'That room is not open.');
    try { assignSeat(room, socket, name, character, resumeToken); } catch (error) { socket.emit('room:error', error.message); }
  });
  socket.on('room:test', ({ name, character, resumeToken } = {}) => {
    const room = createRoom();
    try {
      room.testMode = true;
      assignSeat(room, socket, name || 'You', character, resumeToken);
      beginLevel(room);
    } catch (error) { rooms.delete(room.code); socket.emit('room:error', error.message); }
  });
  socket.on('game:start', () => {
    const room = roomFor(socket);
    if (room?.status === 'LOBBY' && room.hostId === socket.id && room.players.length) beginLevel(room);
  });
  socket.on('game:back-to-lobby', () => {
    const room = roomFor(socket);
    if (room && ['PLAYING', 'ROOM_COMPLETE', 'LOST', 'WON'].includes(room.status) && room.hostId === socket.id) returnToLobby(room);
  });
  socket.on('test:level', (index) => {
    const room = roomFor(socket);
    if (!room?.testMode || !Number.isInteger(index)) return;
    beginLevel(room, index);
  });
  socket.on('game:restart', () => {
    const room = roomFor(socket);
    if (!room || room.hostId !== socket.id || !['LOST', 'WON'].includes(room.status)) return;
    room.hearts = 3; beginLevel(room, 0);
  });
  socket.on('player:position', (position) => {
    const room = roomFor(socket);
    const player = room?.players.find((item) => item.id === socket.id);
    if (!player || room.status !== 'PLAYING') return;
    applyPosition(room, player, position);
  });
  socket.on('player:action', () => {
    const room = roomFor(socket);
    const player = room?.players.find((item) => item.id === socket.id);
    if (player && room.status === 'PLAYING') interact(room, player);
  });
  socket.on('hint:request', () => {
    const room = roomFor(socket);
    if (room?.status !== 'PLAYING') return;
    shareHint(room, false);
  });
  socket.on('player:help', () => {
    const room = roomFor(socket); const player = room?.players.find((item) => item.id === socket.id);
    if (!player || room.status !== 'PLAYING') return;
    const object = room.objects.filter((item) => Math.hypot(item.x - player.x, item.y - player.y) <= 2).sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y))[0];
    const help = object?.type === 'tutorial' ? 'This is the courtyard sign. Stand beside it and press ACTION to read it.' : object?.type === 'key' ? 'This is a key under the pink flag. Stand beside it and press ACTION to pick it up.' : object?.type === 'gate' ? 'This is the castle gate. Bring the key here and press ACTION.' : object?.type === 'flag' ? 'This pink flag marks where the courtyard key is hidden.' : 'Walk near a sparkling object and press ACTION to interact.';
    sendToast(player, help);
  });
  socket.on('gate:submit', (symbols) => {
    const room = roomFor(socket);
    const player = room?.players.find((item) => item.id === socket.id);
    if (!player || room.status !== 'PLAYING' || room.level.id !== 'castle' || !Array.isArray(symbols)) return;
    const correct = symbols.slice(0, 3).join(',') === room.level.code.join(',');
    if (correct) { room.progress.codeOpen = true; room.event = 'The castle lock clicks open!'; }
    sendToast(player, correct ? 'The symbols glow. The gate opens!' : 'Nope! The lock makes a tiny raspberry.');
    sendRoom(room);
  });
  socket.on('disconnect', () => {
    const room = roomFor(socket);
    if (!room) return;
    const player = room.players.find((item) => item.id === socket.id);
    if (!player) return;
    player.connected = false; player.disconnectedAt = Date.now();
    if (room.status === 'PLAYING' && room.players.every((item) => !item.connected)) room.pausedAt = Date.now();
    if (room.hostId === socket.id) room.hostId = room.players.find((item) => item.connected)?.id || socket.id;
    sendRoom(room);
    const disconnectedAt = player.disconnectedAt;
    setTimeout(() => {
      if (player.connected || player.disconnectedAt !== disconnectedAt || rooms.get(room.code) !== room) return;
      room.players = room.players.filter((item) => item !== player);
      if (!room.players.length) rooms.delete(room.code);
      else {
        if (room.hostId === player.id) room.hostId = room.players.find((item) => item.connected)?.id || room.players[0].id;
        sendRoom(room);
      }
    }, RESUME_GRACE_MS);
  });
});

setInterval(() => {
  for (const room of rooms.values()) {
    if (room.status !== 'PLAYING') continue;
    if (room.pausedAt) { sendRoom(room); continue; }
    const idleFor = Date.now() - room.lastProgressAt;
    if (idleFor >= 20000 && room.autoHelpStage < 2) { room.autoHelpStage = 2; shareHint(room, true); }
    else if (idleFor >= 10000 && room.autoHelpStage < 1) { room.autoHelpStage = 1; io.to(room.code).emit('hint:auto-warning'); }
    if (room.level.id === 'garden') gateReady(room);
    if (Date.now() >= room.deadline) {
      room.hearts -= 1;
      room.event = 'Time! A puff of pixie dust sends everyone back to the checkpoint.';
      if (room.hearts <= 0) room.status = 'LOST';
      else {
        room.players.forEach((player) => { player.x = room.level.start.x; player.y = room.level.start.y; player.hurtUntil = Date.now() + 700; });
        room.deadline = Date.now() + AREA_TIME_MS;
      }
    }
    if (room.status === 'PLAYING') for (const player of room.players) { checkAreaExit(room, player); if (room.status !== 'PLAYING') break; }
    sendRoom(room);
  }
}, 67);

const port = process.env.PORT || 3000;
server.listen(port, '0.0.0.0', () => console.log(`CASTLE DASH is ready at http://localhost:${port}`));