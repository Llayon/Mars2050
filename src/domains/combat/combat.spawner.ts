import { SimUnit, BattleAction, SimHazard } from './combat.types';
import { PRNG } from './combat.utils';
import { actionSystem } from './combat.systems';

export function processSpawnerLogic(unit: SimUnit, target: SimUnit, units: SimUnit[], hazards: SimHazard[], actions: BattleAction[], rng: PRNG) {
  if (!unit.spawnerConfig) return;
  
  unit.spawnerConfig.timer--;
  if (unit.spawnerConfig.timer <= 0) {
     unit.spawnerConfig.timer = unit.spawnerConfig.interval;
     // Temporarily set attackType to 'spawn' to leverage existing logic
     const oldType = unit.attackType;
     const oldSpawnType = unit.spawnType;
     unit.attackType = 'spawn';
     unit.spawnType = unit.spawnerConfig.unitType;
     const oldCooldown = unit.actionCooldown;
     unit.actionCooldown = 0; // force spawn
     
     actionSystem(unit, target, units, hazards, actions, rng);
     
     unit.attackType = oldType;
     unit.spawnType = oldSpawnType;
     unit.actionCooldown = oldCooldown;
  }
}
