import { getServerClient } from '@/domains/resource/resource.server'
import { EXPLORATION_BASE_REWARD } from './map.config'

/**
 * Attacks an alien nest at a discovered location.
 */
export async function attackAlienNest(colonyId: string, locationId: string) {
  const supabase = getServerClient()

  // 1. Get location
  const { data: location, error: locError } = await supabase
    .from('map_locations')
    .select('*')
    .eq('id', locationId)
    .single()

  if (locError || !location) return { error: 'Location not found' }
  const resources = (location.resources as Record<string, number>) || {}
  
  if (resources['_alien_nest'] !== 1 || resources['_cleared'] === 1) {
    return { error: 'Здесь нет врагов или они уже уничтожены' }
  }

  // 2. Get attacker units
  const { data: attackerUnits } = await supabase.from('units').select('*').eq('colony_id', colonyId)
  if (!attackerUnits || attackerUnits.length === 0) {
    return { error: 'У вас нет армии для атаки!' }
  }

  // Clear previous grid coordinates so they auto-spawn at the bottom in pixel space
  attackerUnits.forEach(u => {
    u.grid_x = null
    u.grid_y = null
  })

  // 3. Generate alien units based on difficulty
  const alienUnits: import('@/domains/combat/combat.types').UnitRow[] = []
  const diff = location.difficulty
  const alienCount = diff * 2 + Math.floor(Math.random() * diff)
  
  for (let i = 0; i < alienCount; i++) {
    const isSpitter = Math.random() < 0.3
    const isWorm = diff >= 4 && Math.random() < 0.1
    const type: import('@/types/database').UnitsType = isWorm ? 'alien_worm' : isSpitter ? 'alien_spitter' : 'alien_bug'
    
    // Give them fake IDs and row structure so engine accepts them
    alienUnits.push({
      id: `alien_${Math.random()}`,
      colony_id: 'ALIEN_SWARM',
      unit_type: type,
      hp_current: type === 'alien_worm' ? 250 : type === 'alien_spitter' ? 40 : 50,
      grid_x: String(Math.floor(Math.random() * 600)),
      grid_y: String(Math.floor(Math.random() * 400)) // Defenders at top (y: 0-400)
    } as unknown as import('@/domains/combat/combat.types').UnitRow)
  }

  // 4. Import simulateBattle dynamically or statically
  const { simulateBattle } = await import('@/domains/combat/combat.engine')
  const seed = Math.floor(Math.random() * 1000000)
  const battleResult = simulateBattle(attackerUnits, alienUnits, seed)

  // 5. Apply unit deaths
  const deadAttackerIds = attackerUnits
    .filter(u => !battleResult.survivors.some(s => s.id === u.id))
    .map(u => u.id)
  
  if (deadAttackerIds.length > 0) {
    await supabase.from('units').delete().in('id', deadAttackerIds)
  }

  // Update HP for survivors
  for (const survivor of battleResult.survivors) {
    if (survivor.team === 'attacker' && survivor.hp < survivor.maxHp) {
      await supabase.from('units').update({ hp_current: survivor.hp }).eq('id', survivor.id)
    }
  }

  // 6. If attacker wins, grant rewards and clear nest
  const rewards: Record<string, number> = {}
  if (battleResult.winner === 'attacker') {
    resources['_cleared'] = 1
    await supabase.from('map_locations').update({ resources }).eq('id', locationId)

    // Grant resources
    const { data: colonyRes } = await supabase.from('resources').select('type, amount').eq('colony_id', colonyId)
    const resourceMap: Record<string, number> = {}
    if (colonyRes) colonyRes.forEach(r => resourceMap[r.type] = r.amount)

    for (const [resType, multiplier] of Object.entries(resources)) {
      if (resType.startsWith('_')) continue
      const reward = Math.round(multiplier * EXPLORATION_BASE_REWARD / 100) * 2 // 2x reward for PvE
      if (reward > 0) {
        rewards[resType] = reward
        const currentAmount = resourceMap[resType] || 0
        await supabase.from('resources').update({ amount: currentAmount + reward }).eq('colony_id', colonyId).eq('type', resType)
      }
    }
  }

  // 6. Save battle log to DB (without actual logs to save space)
  await supabase.from('battles').insert({
    attacker_colony_id: colonyId,
    defender_colony_id: null,
    winner: battleResult.winner,
    attacker_units: attackerUnits,
    defender_units: alienUnits,
    battle_log: [],
    seed: seed,
    rewards: rewards
  })

  return {
    success: true,
    winner: battleResult.winner,
    logs: battleResult.logs,
    rewards,
    attackerUnits,
    defenderUnits: alienUnits,
    message: battleResult.winner === 'attacker' ? 'Гнездо зачищено! Вы получили награду.' : 'Ваш отряд был уничтожен роем.'
  }
}
