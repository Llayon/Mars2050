import { simulateBattle } from './src/domains/combat/combat.engine';
import type { UnitRow } from './src/domains/combat/combat.types';

const attackers: UnitRow[] = [
  { id: 'a1', unit_type: 'marine', hp_current: 200 } as any
];

const defenders: UnitRow[] = [
  { id: 'd2', unit_type: 'exosuit', hp_current: 1000 } as any
];

const result = simulateBattle(attackers, defenders, 12345);
console.log('Winner:', result.winner);
console.log('Total Ticks:', result.logs.length);
console.log('Last 5 logs:', JSON.stringify(result.logs.slice(-5), null, 2));
