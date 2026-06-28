import { UNIT_TYPES, MAX_TICKS } from './combat.config'
import { GLOBAL_UPGRADES, UPGRADES, GlobalUpgradeConfig } from './combat.upgrades'
import { processGlobals } from './combat.globals'
import { processHazards } from './combat.hazards'
import { processSpawnerLogic } from './combat.spawner'
import { processSupportAuras } from './combat.auras'
import type { UnitRow, BattleAction, BattleTick, BattleResult, UnitTypeKey } from './combat.types'
import type { Team, SimUnit, Obstacle, SimHazard } from './combat.sim.types'
import { actionSystem, tickModifiersSystem } from './combat.systems'
import { targetingSystem } from './combat.targeting'
import { movementSystem } from './combat.movement'
import { createMeleeEngagementState, reserveMeleeEngagementSlot } from './combat.melee-engagement'
import { createCombatMetrics, finalizeCombatMetrics, recordCombatActions, recordCombatTick, type BattleSimulationOptions } from './combat.metrics'
import { FIELD_WIDTH, FIELD_HEIGHT, PRNG, generateObstacles } from './combat.utils'
import { createPathfindingMap } from './combat.pathfinding'
import { SpatialHash } from './spatial-hash'
export function simulateBattle(attackerUnits: UnitRow[], defenderUnits: UnitRow[], providedSeed?: number, providedObstacles?: Obstacle[], attackerGlobals: string[] = [], defenderGlobals: string[] = [], options: BattleSimulationOptions = {}): BattleResult {
  const seed = providedSeed ?? Date.now()
  const rng = new PRNG(seed)
  const dt = 0.1
  const units: SimUnit[] = []
  const hazards: SimHazard[] = []

  const activeGlobals: { team: Team, upg: GlobalUpgradeConfig }[] = []
  attackerGlobals.forEach(id => { if (GLOBAL_UPGRADES[id]) activeGlobals.push({ team: 'attacker', upg: GLOBAL_UPGRADES[id] }) })
  defenderGlobals.forEach(id => { if (GLOBAL_UPGRADES[id]) activeGlobals.push({ team: 'defender', upg: GLOBAL_UPGRADES[id] }) })

  const obstacles: Obstacle[] = providedObstacles || generateObstacles(seed);
  const flowFieldMap = createPathfindingMap(obstacles);
  const spatialHash = new SpatialHash();

  const createSquad = (u: UnitRow, t: Team) => {
    const config = UNIT_TYPES[u.unit_type as keyof typeof UNIT_TYPES]
    if (!config) return
    const squadSize = config.squadSize || 1
    const spacing = config.squadSpacing || 20
    const rowSize = Math.ceil(Math.sqrt(squadSize))

    if (u.grid_x == null) u.grid_x = String(Math.floor(rng.next() * FIELD_WIDTH))
    if (u.grid_y == null) u.grid_y = String(Math.floor(rng.next() * 320) + (t === 'attacker' ? (FIELD_HEIGHT - 320) : 0))

    const cx = Number(u.grid_x)
    const cy = Number(u.grid_y)
    const squadId = squadSize > 1 ? `${u.id}_squad` : undefined
    const formation = config.formation || 'grid'

    let modHp = config.baseStats.hp;
    let modAttack = config.baseStats.attack;
    let modDefense = config.baseStats.defense;
    let modSpeed = config.baseStats.speed * 15;
    let modRange = config.baseStats.range * 40;
    let modCooldown = config.baseStats.actionCooldownMax || 10;
    let modCanTargetAir = config.baseStats.canTargetAir || false;
    let modAoe = config.baseStats.aoeRadius ? config.baseStats.aoeRadius * 40 : undefined;
    let attackType = config.baseStats.attackType || 'single';
    let modShield = 0, modFlying = config.baseStats.isFlying || false;
    let appliesEmp = false, leavesPuddle = false, spawnerConfig: { unitType: string, interval: number, timer: number } | undefined = undefined;
    let modDamageReductionWhileMoving = 0, modOnDeathPuddle: 'napalm' | 'acid' | 'emp' | undefined = undefined;
    let modMultishot = 1, modAntiAirDamageMult = 1.0, modReplicateOnKill = false;
    let modResurrectOnce = false, modStealthUntilAttack = false, modExecuteThreshold = 0;
    let modLifestealMult = 0, modGroundDamageMult = 1.0;

    if (u.upgrade_path && Array.isArray(u.upgrade_path)) {
      for (const upgradeId of u.upgrade_path) {
        const upgrade = UPGRADES[upgradeId]
        if (!upgrade) continue;
        const m = upgrade.modifiers;
        if (m.hpMult) modHp *= m.hpMult; if (m.attackMult) modAttack *= m.attackMult;
        if (m.defenseAdd) modDefense += m.defenseAdd; if (m.speedMult) modSpeed *= m.speedMult;
        if (m.rangeAdd) modRange += m.rangeAdd * 40; if (m.cooldownMult) modCooldown *= m.cooldownMult;
        if (m.addFlying) modFlying = true;
        if (m.grantShield) modShield += config.baseStats.hp * m.grantShield;
        if (m.grantShieldFlat) modShield += m.grantShieldFlat;
        if (m.disableEnemyTech) appliesEmp = true; if (m.leaveAoePuddle) leavesPuddle = true;
        if (m.periodicSpawn) spawnerConfig = { unitType: m.periodicSpawn.unit, interval: m.periodicSpawn.interval * 10, timer: m.periodicSpawn.interval * 10 };
        if (m.onDeathPuddle) modOnDeathPuddle = m.onDeathPuddle;
        if (m.replicateOnKill) modReplicateOnKill = true; if (m.resurrectOnce) modResurrectOnce = true;
        if (m.stealthUntilAttack) modStealthUntilAttack = true; if (m.executeThreshold) modExecuteThreshold = m.executeThreshold;
        if (m.lifestealMult) modLifestealMult = m.lifestealMult; if (m.groundDamageMult) modGroundDamageMult = m.groundDamageMult;
        if (m.damageReductionWhileMoving) modDamageReductionWhileMoving = m.damageReductionWhileMoving;
        if (m.multishot) modMultishot = m.multishot; if (m.antiAirDamageMult) modAntiAirDamageMult = m.antiAirDamageMult;
        if (m.grantAntiAir) modCanTargetAir = true;
        if (m.addAoE) {
          attackType = 'aoe';
          if (!modAoe) modAoe = m.addAoE * 40;
          else modAoe += m.addAoE * 40;
        }
      }
    }

    for (let i = 0; i < squadSize; i++) {
      let ox = 0, oy = 0
      
      if (formation === 'line') {
        ox = (i - (squadSize - 1) / 2) * spacing
        oy = 0
      } else if (formation === 'wedge') {
        // Wedge: 1 in front, 2 behind, 3 behind that
        // Let's do a simple V shape
        const isLeader = i === 0
        if (isLeader) {
          ox = 0; oy = spacing
        } else {
          const side = i % 2 === 0 ? 1 : -1
          const rank = Math.ceil(i / 2)
          ox = side * rank * spacing
          oy = spacing - rank * spacing
        }
      } else {
        // Grid
        const row = Math.floor(i / rowSize)
        const col = i % rowSize
        ox = (col - (rowSize - 1) / 2) * spacing
        oy = (row - (Math.ceil(squadSize / rowSize) - 1) / 2) * spacing
      }

      oy *= (t === 'attacker' ? 1 : -1)

      units.push({
        id: squadSize > 1 ? `${u.id}_${i}` : u.id!,
        squadId,
        team: t,
        type: u.unit_type as UnitTypeKey,
        hp: u.hp_current !== undefined ? Math.min(u.hp_current, modHp) : modHp,
        maxHp: Math.round(modHp),
        attack: Math.round(modAttack),
        defense: modDefense,
        speed: modSpeed,
        range: modRange,
        attackType: attackType,
        spawnType: config.baseStats.spawnType,
        actionCooldownMax: modCooldown,
        actionCooldown: 0,
        isFlying: modFlying,
        canTargetAir: modCanTargetAir,
        turnSpeed: config.baseStats.turnSpeed || 0.5,
        currentAngle: t === 'attacker' ? Math.PI / 2 : -Math.PI / 2,
        initialAngle: t === 'attacker' ? Math.PI / 2 : -Math.PI / 2,
        size: config.baseStats.size || 'M',
        aoeRadius: modAoe,
        shield: Math.round(modShield),
        maxShield: Math.round(modShield),
        statusEffects: [],
        statusOnHit: config.baseStats.statusOnHit ? config.baseStats.statusOnHit.map(status => ({ ...status })) : undefined,
        supportAuras: config.baseStats.supportAuras ? config.baseStats.supportAuras.map(aura => ({ ...aura })) : undefined,
        appliesEmp,
        leavesPuddle,
        spawnerConfig: spawnerConfig ? { ...spawnerConfig } : undefined,
        damageReductionWhileMoving: modDamageReductionWhileMoving,
        onDeathPuddle: modOnDeathPuddle,
        multishot: modMultishot,
        antiAirDamageMult: modAntiAirDamageMult,
        replicateOnKill: modReplicateOnKill,
        resurrectOnce: modResurrectOnce,
        stealthUntilAttack: modStealthUntilAttack,
        executeThreshold: modExecuteThreshold,
        lifestealMult: modLifestealMult,
        groundDamageMult: modGroundDamageMult,
        pullOnHit: config.baseStats.pullOnHit ? { radius: config.baseStats.pullOnHit.radius * 40, strength: config.baseStats.pullOnHit.strength * 40, maxTargets: config.baseStats.pullOnHit.maxTargets } : undefined,
        offsetX: ox,
        offsetY: oy,
        x: cx + ox,
        y: cy + oy,
        aggroLockTicks: 0,
        velocity: { x: 0, y: 0 },
        isDead: false
      })
    }
  }

  attackerUnits.forEach(u => createSquad(u, 'attacker'))
  defenderUnits.forEach(u => createSquad(u, 'defender'))

  const initialState = JSON.parse(JSON.stringify(units))
  const metrics = options.trackMetrics ? createCombatMetrics(units) : undefined

  const logs: BattleTick[] = []
  let tick = 0

  while (tick < MAX_TICKS) {
    const actions: BattleAction[] = []
    processGlobals(tick, activeGlobals, units, hazards, actions, rng);
    processSupportAuras(tick, units, actions);
    
    const aliveAttackers = units.filter(u => !u.isDead && u.team === 'attacker')
    const aliveDefenders = units.filter(u => !u.isDead && u.team === 'defender')
    
    if (aliveAttackers.length === 0 && aliveDefenders.length === 0) break // Draw
    if (aliveAttackers.length === 0) break // Defender wins
    if (aliveDefenders.length === 0) break // Attacker wins

    spatialHash.clear();
    for (const unit of units) {
      if (!unit.isDead) spatialHash.insert(unit);
    }

    const turnOrder = units.filter(u => !u.isDead).sort((a, b) => b.speed - a.speed)
    const meleeEngagement = createMeleeEngagementState();

    for (const unit of turnOrder) {
      if (unit.isDead) continue;
      
      tickModifiersSystem(unit, dt, actions); if (unit.isDead) continue;

      const target = targetingSystem(unit, units, meleeEngagement, spatialHash);
      if (!target) continue;

      const unitCountBeforeActions = units.length;
      processSpawnerLogic(unit, target, units, hazards, actions, rng);

      const canActOnTarget = target.team !== unit.team || unit.attackType === 'heal';
      const hasEngagement = canActOnTarget ? reserveMeleeEngagementSlot(unit, target, meleeEngagement) : true;

      const acted = canActOnTarget && hasEngagement && actionSystem(unit, target, units, hazards, actions, rng);

      for (let i = unitCountBeforeActions; i < units.length; i++) {
        if (!units[i].isDead) spatialHash.insert(units[i]);
      }
      
      if (!acted) {
        movementSystem(unit, target, units, actions, dt, rng, flowFieldMap, obstacles, spatialHash);
        spatialHash.update(unit);
      }
    }

    processHazards(hazards, units, actions);
    if (metrics) { recordCombatActions(metrics, tick, actions, units); recordCombatTick(metrics, units) }
    
    if (actions.length > 0) logs.push({ tick, actions })
    
    tick++
  }

  const finalAttackers = units.filter(u => !u.isDead && u.team === 'attacker')
  const finalDefenders = units.filter(u => !u.isDead && u.team === 'defender')
  let winner: 'attacker' | 'defender' | 'draw' = 'draw'
  if (finalAttackers.length > 0 && finalDefenders.length === 0) winner = 'attacker'
  if (finalDefenders.length > 0) winner = 'defender'

  return {
    winner,
    logs,
    seed,
    initialState,
    survivors: units.filter(u => !u.isDead && !u.isTemporary),
    obstacles,
    metrics: metrics ? finalizeCombatMetrics(metrics, tick) : undefined
  }
}
