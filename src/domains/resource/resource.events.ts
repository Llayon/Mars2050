import { SupabaseClient } from '@supabase/supabase-js'
import { getServerClient } from './resource.server'
import { applyResourceDeltaWithCap } from './resource.storage'

interface PendingEvent {
  id: string
  colony_id: string
  type: string
  data: Record<string, unknown>
  completes_at: string
  processed: boolean
}

interface ResourceSnapshot {
  type: string
  amount: number
}

interface ResourceSingle {
  amount: number
  capacity: number
}

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

  for (const raw of events) {
    const event = raw as unknown as PendingEvent

    switch (event.type) {
      case 'building_complete':
        await processBuildingComplete(event, supabase)
        break
      case 'attack_arrive':
        await processAttackArrive(event, supabase)
        break
      case 'attack_return':
        await processAttackReturn(supabase)
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

async function processBuildingComplete(event: PendingEvent, supabase: SupabaseClient) {
  const buildingId = event.data.building_id as string | undefined
  if (buildingId) {
    await supabase
      .from('buildings')
      .update({ is_active: true })
      .eq('id', buildingId)
  }
}

async function processAttackArrive(event: PendingEvent, supabase: SupabaseClient) {
  const defenderId = event.data.defender_colony_id as string
  const troops = (event.data.attacker_troops as number) || 10
  const defenderLevel = (event.data.defender_level as number) || 1
  const attackerPower = troops * 1.5
  const defenderPower = defenderLevel * 20
  const attackerWins = attackerPower > defenderPower

  if (attackerWins) {
    const { data: defenderResources } = await supabase
      .from('resources')
      .select('type, amount')
      .eq('colony_id', defenderId)

    if (defenderResources) {
      const resources = defenderResources as unknown as ResourceSnapshot[]
      for (const resource of resources) {
        const stolen = Math.floor(resource.amount * 0.1)
        await supabase
          .from('resources')
          .update({ amount: Math.max(0, resource.amount - stolen) })
          .eq('colony_id', defenderId)
          .eq('type', resource.type)

        const { data: attackerResource } = await supabase
          .from('resources')
          .select('amount, capacity')
          .eq('colony_id', event.colony_id)
          .eq('type', resource.type)
          .single()

        if (attackerResource) {
          const ar = attackerResource as unknown as ResourceSingle
          await supabase
            .from('resources')
            .update({ amount: applyResourceDeltaWithCap(ar.amount, ar.capacity, stolen) })
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

async function processAttackReturn(_supabase: SupabaseClient) {
}

async function processResearchComplete(event: PendingEvent, supabase: SupabaseClient) {
  const researchPoints = (event.data.points as number) || 50

  const { data: resource } = await supabase
    .from('resources')
    .select('amount, capacity')
    .eq('colony_id', event.colony_id)
    .eq('type', 'research_points')
    .single()

  if (resource) {
    const r = resource as unknown as ResourceSingle
    await supabase
      .from('resources')
      .update({ amount: applyResourceDeltaWithCap(r.amount, r.capacity, researchPoints) })
      .eq('colony_id', event.colony_id)
      .eq('type', 'research_points')
  }
}
