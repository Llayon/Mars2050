import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { getServerClient } from './resource.server'

/**
 * Process all completed pending events for a colony.
 * Called automatically by recalculateResources.
 */
export async function processCompletedEvents(colonyId: string) {
  const supabase = getServerClient()
  const now = new Date().toISOString()

  const { data: events, error } = await supabase
    .from('pending_events')
    .select('id, colony_id, type, data, completes_at, processed')
    .eq('colony_id', colonyId)
    .eq('processed', false)
    .lte('completes_at', now)

  if (error || !events || events.length === 0) return

  for (const event of events) {
    switch (event.type) {
      case 'building_complete':
        await processBuildingComplete(event, supabase)
        break
      case 'attack_arrive':
        await processAttackArrive(event, supabase)
        break
      case 'attack_return':
        await processAttackReturn(event, supabase)
        break
      case 'research_complete':
        await processResearchComplete(event, supabase)
        break
    }

    await supabase
      .from('pending_events')
      .update({ processed: true, processed_at: now })
      .eq('id', event.id)
  }
}

async function processBuildingComplete(event: any, supabase: SupabaseClient<any>) {
  const { building_id: buildingId } = event.data
  if (buildingId) {
    await supabase
      .from('buildings')
      .update({ is_active: true })
      .eq('id', buildingId)
  }
}

async function processAttackArrive(event: any, supabase: SupabaseClient<any>) {
  const { defender_colony_id: defenderId, attacker_troops: troops } = event.data
  const defenderLevel = event.data.defender_level || 1
  const attackerPower = (troops || 10) * 1.5
  const defenderPower = defenderLevel * 20
  const attackerWins = attackerPower > defenderPower

  if (attackerWins) {
    const { data: defenderResources } = await supabase
      .from('resources')
      .select('type, amount')
      .eq('colony_id', defenderId)

    if (defenderResources) {
      for (const resource of defenderResources) {
        const stolen = Math.floor(resource.amount * 0.1)
        await supabase
          .from('resources')
          .update({ amount: Math.max(0, resource.amount - stolen) })
          .eq('colony_id', defenderId)
          .eq('type', resource.type)

        const { data: attackerResource } = await supabase
          .from('resources')
          .select('amount')
          .eq('colony_id', event.colony_id)
          .eq('type', resource.type)
          .single()

        if (attackerResource) {
          await supabase
            .from('resources')
            .update({ amount: attackerResource.amount + stolen })
            .eq('colony_id', event.colony_id)
            .eq('type', resource.type)
        }
      }
    }
  }

  const returnTime = new Date(Date.now() + 30 * 60 * 1000).toISOString()
  await supabase
    .from('pending_events')
    .insert({
      colony_id: event.colony_id,
      type: 'attack_return',
      data: { ...event.data, result: attackerWins ? 'victory' : 'defeat' },
      completes_at: returnTime
    })
}

async function processAttackReturn(_event: any, _supabase: SupabaseClient<any>) {
  // Troops have returned - no action needed for now
}

async function processResearchComplete(event: any, supabase: SupabaseClient<any>) {
  const researchPoints = event.data.points || 50

  const { data: resource } = await supabase
    .from('resources')
    .select('amount')
    .eq('colony_id', event.colony_id)
    .eq('type', 'research_points')
    .single()

  if (resource) {
    await supabase
      .from('resources')
      .update({ amount: resource.amount + researchPoints })
      .eq('colony_id', event.colony_id)
      .eq('type', 'research_points')
  }
}