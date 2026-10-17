import crypto from 'node:crypto';

export function sha256(data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return crypto.createHash('sha256').update(str).digest('hex');
}

export function createDef(id, over = {}) {
  return {
    id,
    name: id,
    baseStats: {
      hp: 500,
      attack: 15,
      defense: 2,
      speed: 60,
      range: 40,
      attackType: 'single',
      actionCooldownMax: 10,
      turnSpeed: 5,
      size: 'M',
      combatTags: [],
      ...over,
    },
    squadSize: 1,
    squadSpacing: 20,
    formation: 'grid',
  };
}

export const COMMON_SCENARIOS = {
  'melee-duel': {
    name: '1v1 Melee duel on standard arena',
    input: {
      seed: 4242,
      arena: { width: 600, height: 1200, tileSize: 40, obstacles: [] },
      rules: { maxTicks: 200, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
      definitions: {
        knight: createDef('knight', { hp: 450, attack: 18, defense: 4 }),
        brute: createDef('brute', { hp: 550, attack: 14, defense: 2 }),
      },
      units: [
        { instanceId: 'k1', definitionId: 'knight', team: 'attacker', placement: { x: 300, y: 900 }, rank: 1, upgradeIds: [] },
        { instanceId: 'b1', definitionId: 'brute', team: 'defender', placement: { x: 300, y: 300 }, rank: 1, upgradeIds: [] },
      ],
      scheduledEffects: [],
    },
  },

  'burn-siege': {
    name: 'Pyromancer burn vs high HP Golem',
    input: {
      seed: 5353,
      arena: { width: 600, height: 1200, tileSize: 40, obstacles: [] },
      rules: { maxTicks: 150, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
      definitions: {
        pyro: createDef('pyro', { hp: 300, attack: 20, speed: 50, range: 200, statusOnHit: [{ type: 'burn', duration: 25, value: 10 }] }),
        golem: createDef('golem', { hp: 2000, defense: 0, speed: 0 }),
      },
      units: [
        { instanceId: 'p1', definitionId: 'pyro', team: 'attacker', placement: { x: 300, y: 800 }, rank: 1, upgradeIds: [] },
        { instanceId: 'g1', definitionId: 'golem', team: 'defender', placement: { x: 300, y: 700 }, rank: 1, upgradeIds: [] },
      ],
      scheduledEffects: [],
    },
  },

  'summon-clash': {
    name: 'In-combat summoning clash',
    input: {
      seed: 6464,
      arena: { width: 600, height: 1200, tileSize: 40, obstacles: [] },
      rules: { maxTicks: 250, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
      definitions: {
        shaman: createDef('shaman', { hp: 250, attack: 0, range: 180, attackType: 'spawn', spawnType: 'imp', spawnCap: 2, actionCooldownMax: 20, combatTags: ['summoner'] }),
        imp: createDef('imp', { hp: 120, attack: 8, speed: 70, range: 30, combatTags: ['summoned'] }),
        guard: createDef('guard', { hp: 400, attack: 12, speed: 45 }),
      },
      units: [
        { instanceId: 'shaman1', definitionId: 'shaman', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: [] },
        { instanceId: 'g1', definitionId: 'guard', team: 'attacker', placement: { x: 250, y: 950 }, rank: 1, upgradeIds: [] },
        { instanceId: 'd1', definitionId: 'guard', team: 'defender', placement: { x: 300, y: 250 }, rank: 1, upgradeIds: [] },
      ],
      scheduledEffects: [],
    },
  },

  'timeout-defense': {
    name: 'Timeout policy attacker_win resolution',
    input: {
      seed: 7575,
      arena: { width: 600, height: 1200, tileSize: 40, obstacles: [] },
      rules: { maxTicks: 15, timeoutPolicy: 'attacker_win', defenseResolutionMode: 'v9_snapshot' },
      definitions: {
        sentryA: createDef('sentryA', { speed: 0 }),
        sentryD: createDef('sentryD', { speed: 0 }),
      },
      units: [
        { instanceId: 'sa1', definitionId: 'sentryA', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: [] },
        { instanceId: 'sd1', definitionId: 'sentryD', team: 'defender', placement: { x: 300, y: 200 }, rank: 1, upgradeIds: [] },
      ],
      scheduledEffects: [],
    },
  },

  'mixed-squads': {
    name: 'Multi-unit clash on custom 800x800 arena with obstacles and heal',
    input: {
      seed: 8686,
      arena: {
        width: 800,
        height: 800,
        tileSize: 40,
        obstacles: [
          { x: 360, y: 360, radius: 40 },
        ],
      },
      rules: { maxTicks: 200, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
      definitions: {
        warrior: createDef('warrior', { hp: 350, attack: 16, defense: 3, speed: 50, combatTags: ['organic'] }),
        priest: createDef('priest', { hp: 200, attack: 15, speed: 40, range: 140, attackType: 'heal', healTargetTags: ['organic'], combatTags: ['healer', 'organic'] }),
        cyborg: createDef('cyborg', { hp: 320, attack: 18, defense: 2, speed: 55, combatTags: ['mechanical'] }),
      },
      units: [
        { instanceId: 'w1', definitionId: 'warrior', team: 'attacker', placement: { x: 250, y: 650 }, rank: 1, upgradeIds: [] },
        { instanceId: 'p1', definitionId: 'priest', team: 'attacker', placement: { x: 200, y: 700 }, rank: 1, upgradeIds: [] },
        { instanceId: 'c1', definitionId: 'cyborg', team: 'defender', placement: { x: 550, y: 150 }, rank: 1, upgradeIds: [] },
        { instanceId: 'c2', definitionId: 'cyborg', team: 'defender', placement: { x: 600, y: 200 }, rank: 1, upgradeIds: [] },
      ],
      scheduledEffects: [
        { id: 'shield_eff', tick: 5, team: 'attacker', type: 'mass_shield', value: 40 },
      ],
    },
  },
};

export function runSingleScenario(key, simulateCombat) {
  const scenario = COMMON_SCENARIOS[key];
  if (!scenario) throw new Error(`Unknown scenario: ${key}`);
  const inputCopy = JSON.parse(JSON.stringify(scenario.input));
  const result = simulateCombat(inputCopy);

  const cleanMetadata = result.metadata ? {
    contractVersion: result.metadata.contractVersion,
    engine: result.metadata.engine,
    ruleset: result.metadata.ruleset,
    replaySchema: result.metadata.replaySchema,
  } : null;

  return {
    scenario: key,
    winner: result.winner,
    terminationReason: result.terminationReason,
    elapsedTicks: result.elapsedTicks,
    initialStateCount: result.initialState.length,
    survivorsCount: result.survivors.length,
    logsCount: result.logs.length,
    initialStateSha256: sha256(result.initialState),
    survivorsSha256: sha256(result.survivors),
    logsSha256: sha256(result.logs),
    metadataSha256: cleanMetadata ? sha256(cleanMetadata) : null,
  };
}

export function runAllScenarios(simulateCombat) {
  const reports = {};
  for (const key of Object.keys(COMMON_SCENARIOS)) {
    reports[key] = runSingleScenario(key, simulateCombat);
  }
  return reports;
}
