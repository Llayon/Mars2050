import { UNIT_TYPES, MAX_TICKS } from './combat.config'
import { GLOBAL_UPGRADES, UPGRADES, GlobalUpgradeConfig } from './combat.upgrades'
import { processGlobals } from './combat.globals'
import { processHazards } from './combat.hazards'
import { processSpawnerLogic } from './combat.spawner'
import type { UnitRow, Team, SimUnit, BattleAction, BattleTick, BattleResult, Obstacle, SimHazard, UnitTypeKey } from './combat.types'
import { actionSystem, tickModifiersSystem } from './combat.systems'
import { targetingSystem } from './combat.targeting'
import { movementSystem } from './combat.movement'
import { getDistance, FIELD_WIDTH, FIELD_HEIGHT, PRNG, generateObstacles } from './combat.utils'
import { createPathfindingMap, FlowFieldMap } from './combat.pathfinding'




export function simulateBattle(attackerUnits: UnitRow[], defenderUnits: UnitRow[], providedSeed?: number, providedObstacles?: Obstacle[], attackerGlobals: string[] = [], defenderGlobals: string[] = []): BattleResult {
  const seed = providedSeed || Date.now()
  const rng = new PRNG(seed)
  const dt = 0.1
  const units: SimUnit[] = []
  const hazards: SimHazard[] = []

  const activeGlobals: { team: Team, upg: GlobalUpgradeConfig }[] = []
  attackerGlobals.forEach(id => { if (GLOBAL_UPGRADES[id]) activeGlobals.push({ team: 'attacker', upg: GLOBAL_UPGRADES[id] }) })
  defenderGlobals.forEach(id => { if (GLOBAL_UPGRADES[id]) activeGlobals.push({ team: 'defender', upg: GLOBAL_UPGRADES[id] }) })

  // Generate or use provided obstacles
  const obstacles: Obstacle[] = providedObstacles || generateObstacles(seed);

  const flowFieldMap = createPathfindingMap(obstacles);

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

    // Calculate base stats with upgrades
    let modHp = config.baseStats.hp;
    let modAttack = config.baseStats.attack;
    let modDefense = config.baseStats.defense;
    let modSpeed = config.baseStats.speed * 15;
    let modRange = config.baseStats.range * 40;
    let modCooldown = config.baseStats.actionCooldownMax || 10;
    let modFlying = config.baseStats.isFlying || false;
    let modCanTargetAir = config.baseStats.canTargetAir || false;
    let modAoe = config.baseStats.aoeRadius ? config.baseStats.aoeRadius * 40 : undefined;
    let attackType = config.baseStats.attackType || 'single';
    let modShield = 0;
    let appliesEmp = false;
    let leavesPuddle = false;
    let spawnerConfig: { unitType: string, interval: number, timer: number } | undefined = undefined;
    
    let modDamageReductionWhileMoving = 0;
    let modOnDeathPuddle: 'napalm' | 'acid' | 'emp' | undefined = undefined;
    let modMultishot = 1;
    let modAntiAirDamageMult = 1.0;
    let modReplicateOnKill = false;

    if (u.upgrade_path && Array.isArray(u.upgrade_path)) {
      for (const upgradeId of u.upgrade_path) {
        const upgrade = UPGRADES[upgradeId]
        if (!upgrade) continue;
        const m = upgrade.modifiers;
        if (m.hpMult) modHp *= m.hpMult;
        if (m.attackMult) modAttack *= m.attackMult;
        if (m.defenseAdd) modDefense += m.defenseAdd;
        if (m.speedMult) modSpeed *= m.speedMult;
        if (m.rangeAdd) modRange += m.rangeAdd * 40;
        if (m.cooldownMult) modCooldown *= m.cooldownMult;
        if (m.addFlying) modFlying = true;
        if (m.grantShield) modShield += config.baseStats.hp * m.grantShield;
        if (m.grantShieldFlat) modShield += m.grantShieldFlat;
        if (m.disableEnemyTech) appliesEmp = true;
        if (m.leaveAoePuddle) leavesPuddle = true;
        if (m.periodicSpawn) spawnerConfig = { unitType: m.periodicSpawn.unit, interval: m.periodicSpawn.interval * 10, timer: m.periodicSpawn.interval * 10 }; // interval in ticks (10 ticks = 1 sec approx)
        if (m.damageReductionWhileMoving) modDamageReductionWhileMoving = m.damageReductionWhileMoving;
        if (m.onDeathPuddle) modOnDeathPuddle = m.onDeathPuddle;
        if (m.multishot) modMultishot = m.multishot;
        if (m.antiAirDamageMult) modAntiAirDamageMult = m.antiAirDamageMult;
        if (m.grantAntiAir) modCanTargetAir = true;
        if (m.replicateOnKill) modReplicateOnKill = true;
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

      // Flip Y based on team
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
        appliesEmp,
        leavesPuddle,
        spawnerConfig: spawnerConfig ? { ...spawnerConfig } : undefined,
        damageReductionWhileMoving: modDamageReductionWhileMoving,
        onDeathPuddle: modOnDeathPuddle,
        multishot: modMultishot,
        antiAirDamageMult: modAntiAirDamageMult,
        replicateOnKill: modReplicateOnKill,
        offsetX: ox,
        offsetY: oy,
        x: cx + ox,
        y: cy + oy,
        isDead: false
      })
    }
  }

  attackerUnits.forEach(u => createSquad(u, 'attacker'))
  defenderUnits.forEach(u => createSquad(u, 'defender'))

  const initialState = JSON.parse(JSON.stringify(units))

  const logs: BattleTick[] = []
  let tick = 0

  while (tick < MAX_TICKS) {
    const actions: BattleAction[] = []
    
    processGlobals(tick, activeGlobals, units, hazards, actions, rng);
    
    // Check win condition before tick
    const aliveAttackers = units.filter(u => !u.isDead && u.team === 'attacker')
    const aliveDefenders = units.filter(u => !u.isDead && u.team === 'defender')
    
    if (aliveAttackers.length === 0 && aliveDefenders.length === 0) break // Draw
    if (aliveAttackers.length === 0) break // Defender wins
    if (aliveDefenders.length === 0) break // Attacker wins

    // Sort units by speed descending
    const turnOrder = units.filter(u => !u.isDead).sort((a, b) => b.speed - a.speed)
    const meleeTargetCounts: Record<string, number> = {};

    for (const unit of turnOrder) {
      if (unit.isDead) continue;
      
      tickModifiersSystem(unit, dt, actions);

      const target = targetingSystem(unit, units, meleeTargetCounts);
      if (!target) continue;

      processSpawnerLogic(unit, target, units, hazards, actions, rng);

      // Register slot taken if melee unit
      if (unit.range <= 60) {
         meleeTargetCounts[target.id] = (meleeTargetCounts[target.id] || 0) + 1;
      }

      const acted = actionSystem(unit, target, units, hazards, actions, rng);
      
      if (!acted) {
        movementSystem(unit, target, units, actions, dt, rng, flowFieldMap, obstacles);
      }
    }

    processHazards(hazards, units, actions);
    
    if (actions.length > 0) logs.push({ tick, actions })
    
    tick++
  }

  const finalAttackers = units.filter(u => !u.isDead && u.team === 'attacker')
  const finalDefenders = units.filter(u => !u.isDead && u.team === 'defender')
  let winner: 'attacker' | 'defender' | 'draw' = 'draw'
  if (finalAttackers.length > 0 && finalDefenders.length === 0) winner = 'attacker'
  if (finalDefenders.length > 0 && finalAttackers.length === 0) winner = 'defender'
  if (finalAttackers.length > 0 && finalDefenders.length > 0) winner = 'defender'

  return {
    winner,
    logs,
    seed,
    initialState,
    survivors: units.filter(u => !u.isDead && !u.isTemporary),
    obstacles
  }
}
