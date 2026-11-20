// Solmar: configuration and tuning for the whole game.
// One place for the numbers every system shares: city layout, physics,
// wanted levels, weapons, missions and audio.

export const CFG = {
  title: 'SOLMAR',
  tagline: 'A sun-soaked open-world crime story',
  saveKey: 'solmar-save-v1',

  // City: a grid of square blocks separated by roads.
  city: {
    blocksX: 8,
    blocksZ: 8,
    blockSize: 56,
    roadWidth: 14,
    sidewalkWidth: 4,
    buildingMin: 10,
    buildingMax: 34,
    // Beach along the south edge (positive Z), port along the east edge.
    beachDepth: 46,
    seaWidth: 220,
  },

  // Player on foot.
  player: {
    walkSpeed: 6,
    runSpeed: 10.5,
    accel: 40,
    jumpSpeed: 8.5,
    gravity: 24,
    radius: 0.55,
    height: 1.8,
    maxHealth: 100,
    maxArmor: 100,
    regenDelay: 5,
    regenRate: 8,
    punchDamage: 12,
    punchRange: 2.1,
  },

  // Cars: arcade handling.
  car: {
    accel: 26,
    brake: 42,
    reverseAccel: 16,
    maxSpeed: 42,
    maxReverse: 12,
    steerMax: 0.55,
    steerSpeed: 2.6,
    grip: 8,
    handbrakeGrip: 2.2,
    radius: 2.1,
    enterRange: 4.5,
  },

  traffic: { count: 14, speed: 11, minGap: 7 },
  pedestrians: { count: 26, speed: 1.6, fleeSpeed: 4.2 },

  // Wanted levels: stars, how many police units, how fast they arrive.
  wanted: {
    decayOutOfSight: 18,
    bustHoldTime: 2.5,
    levels: [
      null,
      { stars: 1, cars: 1, cops: 0 },
      { stars: 2, cars: 2, cops: 1 },
      { stars: 3, cars: 3, cops: 2 },
      { stars: 4, cars: 4, cops: 3 },
      { stars: 5, cars: 5, cops: 4 },
      // Six stars: full manhunt. Every unit in the city is after Rico.
      { stars: 6, cars: 6, cops: 6 },
    ],
  },

  police: {
    carSpeed: 40,
    carAccel: 30,
    copSpeed: 5.2,
    ramDamage: 6,
    punchDamage: 8,
    sightRange: 70,
    spawnRange: 55,
  },

  weapons: {
    fists: { name: 'Fists', damage: 12, range: 2.1, rate: 0.45, auto: false },
    pistol: { name: 'P9 Pistol', damage: 34, range: 90, rate: 0.22, auto: false, mag: 12, reload: 1.1 },
    // Close-range king: seven pellets per shell, devastating up close,
    // useless past a block. Slow to pump, slow to reload.
    shotgun: { name: 'Shotgun', damage: 14, pellets: 7, spread: 0.085, range: 30, rate: 0.9, auto: false, mag: 6, reload: 2.0 },
    // Bullet hose: weak per round, but it never stops while held.
    smg: { name: 'SMG', damage: 12, range: 55, rate: 0.09, auto: true, mag: 30, reload: 1.4 },
    // The all-rounder: solid damage, long reach, full auto.
    rifle: { name: 'Assault Rifle', damage: 26, range: 110, rate: 0.13, auto: true, mag: 30, reload: 1.7 },
  },

  // Golden hour: the whole game plays at one warm late afternoon.
  sun: {
    color: 0xffe0b3,
    intensity: 1.35,
    position: [120, 90, 60],
    skyTop: '#7fb2e0',
    skyMid: '#cfd9e8',
    skyBottom: '#f7c98a',
    fogColor: 0xe8c9a0,
    fogNear: 120,
    fogFar: 520,
  },

  // Camera.
  camera: {
    footDistance: 7.5,
    footHeight: 3.2,
    carDistance: 10.5,
    carHeight: 4.2,
    smooth: 8,
  },
};

// Mission rewards in dollars.
export const MISSION_REWARDS = [500, 800, 1000, 1500, 3000, 1200, 1500, 2000, 2500, 5000];

// The ten story missions. Each has an id, a name, a briefing and a list of
// stages; a stage is complete when its check passes.
export const MISSIONS = [
  {
    id: 'm1',
    name: 'Back in the Game',
    reward: 500,
    briefing: 'Sofia: Rico, you are out. My sedan is parked by the Anchor. Drive it to the docks and meet me. No trouble, just drive.',
  },
  {
    id: 'm2',
    name: 'Borrowed Wheels',
    reward: 800,
    briefing: 'Sofia: A Comet GT is parked on the Strip, cherry red, keys in it. Take it. The chop shop at Harbor Yards pays good money for it.',
  },
  {
    id: 'm3',
    name: 'Heat Wave',
    reward: 1000,
    briefing: 'Sofia: The cops are sniffing around after that Comet. Lose them. Get out of sight and stay clean until the heat dies down.',
  },
  {
    id: 'm4',
    name: 'Dockside',
    reward: 1500,
    briefing: 'Sofia: Los Buitres took our dock. El Halcon\'s boys are holding it. Go in armed, clear them out, and the docks are ours again.',
  },
  {
    id: 'm5',
    name: 'The Big Score',
    reward: 3000,
    briefing: 'Sofia: The Solmar Grand keeps its weekend take in the back. We go in, we take it, we leave by boat. This is the one, Rico.',
  },
  {
    id: 'm6',
    name: 'Smuggler\'s Run',
    reward: 1200,
    briefing: 'Sofia: A blue van is waiting at Harbor Yards with a delivery that cannot wait. Pick it up and bring it to the Anchor. No stops, no cops.',
  },
  {
    id: 'm7',
    name: 'Street Kings',
    reward: 1500,
    briefing: 'Sofia: The Strip racers think nobody can beat them. Prove them wrong. Start line on the Strip, three checkpoints, finish downtown. Drive like you mean it.',
  },
  {
    id: 'm8',
    name: 'El Halcon\'s Debt',
    reward: 2000,
    briefing: 'Sofia: El Halcon himself is at the docks with his whole crew, and he owes us. Go in armed. Eight gunmen, and the man in the gold shirt is the one who matters.',
  },
  {
    id: 'm9',
    name: 'The Getaway',
    reward: 2500,
    briefing: 'Sofia: Four stars, Rico. The whole Solmar PD is on you after that van job. Lose them, stay out of sight, then lay low at the Anchor.',
  },
  {
    id: 'm10',
    name: 'The El Halcon Job',
    reward: 5000,
    briefing: 'Sofia: The Solmar Grand, one more time, and this time it is El Halcon\'s money in the back room. Take it and the whole city will come for you. Six stars. Run for the boat and do not stop.',
  },
];
