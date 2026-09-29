// Tile legend: # wall/tree, . grass, = road, ~ puddle, ! bee hazard, S start, E exit,
// C clue sign, B bush, T tulip, P pressure plate, O pushable stone, R plank, X bridge, D gate, L lock, G tutorial gate.
const LEVELS = [
  {
    id: 'courtyard', title: 'The Courtyard', start: { x: 3.5, y: 11.5 }, exit: { x: 20.5, y: 2.5 },
    story: 'A tiny knight locked the gate, then misplaced the key. Classic knight behavior.',
    puzzleSteps: [
      { objective: 'Talk to the signpost', target: 'courtyard-sign', hints: ['The signpost looks like it has something to say.', 'Walk to the sign near the starting path and press ACTION.', 'Talk to the signpost. It explains that Hoot’s hints are safe and never block progress.'] },
      { objective: 'Pick up the key under the pink flag', target: 'courtyard-key', hints: ['A little key is hiding somewhere in the courtyard.', 'Look beneath the pink flag in the middle of the yard.', 'Walk to the key under the pink flag and press ACTION.'] },
      { objective: 'Use the key at the castle gate', target: 'courtyard-gate', hints: ['The key probably fits something bigger than a cupboard.', 'Walk to the locked gate at the far end of the path.', 'Stand beside the castle gate and press ACTION while carrying the key.'] }
    ],
    tiles: ['########################', '#......................#', '#...................E..#', '#......................#', '####################G..#', '#......................#', '#......................#', '#......................#', '#......................#', '#......................#', '#......................#', '#..S...................#', '#......................#', '########################'],
    objects: [
      { id: 'courtyard-sign', type: 'tutorial', x: 5.5, y: 10.5, clue: 'Welcome! Hoot’s HINT button is safe to use. Hints never block your progress.' },
      { id: 'courtyard-flag', type: 'flag', x: 12.5, y: 6.5 },
      { id: 'courtyard-key', type: 'key', x: 12.5, y: 7.5 },
      { id: 'courtyard-gate', type: 'gate', x: 20.5, y: 5.2 }
    ]
  },
  {
    id: 'forest', title: 'Mushroom Forest', start: { x: 2.5, y: 11.5 }, exit: { x: 20.5, y: 2.5 },
    tiles: ['########################', '#....B.......T.........#', '#......................#', '#..B..............B....#', '#......................#', '#......B...............#', '#......................#', '#..............T.......#', '#..B...................#', '#......................#', '#..........B...........#', '#S.....................#', '#....................E.#', '########################'],
    objects: [
      { id: 'forest-bush-a', type: 'search', x: 5.5, y: 1.5, clue: 'The hidden key is beneath a tulip, not a bush.', correct: false },
      { id: 'forest-tulip', type: 'search', x: 14.5, y: 1.5, clue: 'A tiny key is tucked under this tulip.', correct: true },
      { id: 'forest-bush-b', type: 'search', x: 3.5, y: 3.5, clue: 'This bush only contains a sleepy beetle.', correct: false },
      { id: 'forest-bush-c', type: 'search', x: 19.5, y: 3.5, clue: 'No key here. Just leaves.', correct: false },
      { id: 'forest-bush-d', type: 'search', x: 7.5, y: 5.5, clue: 'This bush is empty.', correct: false },
      { id: 'forest-tulip-b', type: 'search', x: 16.5, y: 7.5, clue: 'Only a ladybug lives here.', correct: false },
      { id: 'forest-bush-e', type: 'search', x: 3.5, y: 8.5, clue: 'This bush is empty.', correct: false },
      { id: 'forest-bush-f', type: 'search', x: 11.5, y: 10.5, clue: 'This bush is empty.', correct: false },
      { id: 'forest-note', type: 'clue', x: 10.5, y: 3.5, clue: 'Look under the tulip with the pink petals.' },
      { id: 'forest-trickster', type: 'trickster', x: 9.5, y: 9.5, clue: 'The hidden key is under the very last bush.', truth: 'The key is under the pink tulip.' }
    ]
  },
  {
    id: 'bridge', title: 'Broken Bridge', start: { x: 2.5, y: 11.5 }, exit: { x: 21.5, y: 11.5 },
    tiles: ['########################', '#......................#', '#......................#', '#......................#', '#......................#', '#......................#', '#..........~~~~........#', '#..........~~~~........#', '#..........XXXX........#', '#..........~~~~........#', '#..........~~~~........#', '#S.........~~~~.......E#', '#......................#', '########################'],
    objects: [
      { id: 'plank-a', type: 'plank', x: 5.5, y: 3.5 }, { id: 'plank-b', type: 'plank', x: 17.5, y: 4.5 },
      { id: 'plank-c', type: 'plank', x: 7.5, y: 9.5 }, { id: 'bridge-planks', type: 'bridge', x: 12.5, y: 8.5 },
      { id: 'bridge-statue', type: 'clue', x: 9.5, y: 2.5, clue: 'Three planks make one very wobbly bridge.' },
      { id: 'bridge-trickster', type: 'trickster', x: 17.5, y: 9.5, clue: 'The bridge needs only one plank.', truth: 'Find three planks and bring them to the bridge.' }
    ]
  },
  {
    id: 'garden', title: 'Garden Gate', start: { x: 2.5, y: 11.5 }, exit: { x: 21.5, y: 2.5 },
    tiles: ['########################', '#....................E.#', '#......................#', '#....P........P.........#', '#......................#', '#..O................O..#', '#......................#', '#...........P..........#', '#......................#', '#..O................O..#', '#......................#', '#S.........D...........#', '#......................#', '########################'],
    objects: [
      { id: 'plate-left', type: 'plate', x: 5.5, y: 3.5 }, { id: 'plate-middle', type: 'plate', x: 14.5, y: 3.5 },
      { id: 'plate-right', type: 'plate', x: 12.5, y: 7.5 }, { id: 'stone-a', type: 'stone', x: 3.5, y: 5.5 },
      { id: 'stone-b', type: 'stone', x: 19.5, y: 5.5 }, { id: 'stone-c', type: 'stone', x: 3.5, y: 9.5 },
      { id: 'stone-d', type: 'stone', x: 19.5, y: 9.5 }, { id: 'garden-sign', type: 'clue', x: 9.5, y: 9.5, clue: 'Three plates need three feet... or three patient stones.' },
      { id: 'garden-trickster', type: 'trickster', x: 16.5, y: 9.5, clue: 'Stand on just one plate to open the gate.', truth: 'All three plates must be held down together.' }
    ]
  },
  {
    id: 'castle', title: 'Castle Gate', start: { x: 2.5, y: 11.5 }, exit: { x: 21.5, y: 2.5 },
    tiles: ['########################', '#....................E.#', '#......................#', '#....C.................#', '#......................#', '#..............C.......#', '#......................#', '#......................#', '#..C...................#', '#......................#', '#......................#', '#S..................L..#', '#......................#', '########################'],
    objects: [
      { id: 'symbol-sun', type: 'symbol', x: 5.5, y: 3.5, symbol: 'SUN', clue: 'The first lock symbol is SUN.' },
      { id: 'symbol-moon', type: 'symbol', x: 15.5, y: 5.5, symbol: 'MOON', clue: 'The second lock symbol is MOON.' },
      { id: 'symbol-star', type: 'symbol', x: 3.5, y: 8.5, symbol: 'STAR', clue: 'The last lock symbol is STAR.' },
      { id: 'castle-trickster', type: 'trickster', x: 18.5, y: 7.5, clue: 'The code starts with MOON.', truth: 'The symbols are written in order on the signs.' },
      { id: 'final-lock', type: 'lock', x: 19.5, y: 11.5 }
    ], code: ['SUN', 'MOON', 'STAR']
  }
];

const normalized = LEVELS.map((level) => {
  const width = Math.max(...level.tiles.map((row) => row.length));
  return { ...level, tiles: level.tiles.map((row) => row.padEnd(width, '#').split('')) };
});
if (typeof module !== 'undefined') module.exports = normalized;
if (typeof window !== 'undefined') window.CASTLE_LEVELS = normalized;