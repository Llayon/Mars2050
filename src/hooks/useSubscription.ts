'use client'

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

type TableName = 'resources' | 'events' | 'buildings' | 'map_locations' | 'pending_events'

type ChangePayload = {
  table: TableName
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: Record<string, unknown>
  old: Record<string, unknown>
}

type Subscriber = {
  table: TableName
  colonyId: string | null
  callback: (payload: ChangePayload) => void
}

const subscribers: Subscriber[] = []
let channel: ReturnType<typeof supabase.channel> | null = null
let activeSubCount = 0

function matchesFilter(row: Record<string, unknown>, colonyId?: string | null): boolean {
  if (!colonyId) return true
  return row.colony_id === colonyId
}

function dispatchToSubscribers(table: TableName, eventType: 'INSERT' | 'UPDATE' | 'DELETE', newRow: Record<string, unknown>, oldRow: Record<string, unknown>) {
  for (const sub of subscribers) {
    if (sub.table !== table) continue
    if (!matchesFilter(newRow, sub.colonyId)) continue
    sub.callback({ table, eventType, new: newRow, old: oldRow })
  }
}

function ensureChannel() {
  if (channel) return
  channel = supabase
    .channel('mars2050-sync')
    .on('postgres_changes', { event: '*' as const, schema: 'public', table: 'resources' }, (p: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      dispatchToSubscribers('resources', p.eventType, p.new, p.old)
    })
    .on('postgres_changes', { event: '*' as const, schema: 'public', table: 'events' }, (p: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      dispatchToSubscribers('events', p.eventType, p.new, p.old)
    })
    .on('postgres_changes', { event: '*' as const, schema: 'public', table: 'buildings' }, (p: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      dispatchToSubscribers('buildings', p.eventType, p.new, p.old)
    })
    .on('postgres_changes', { event: '*' as const, schema: 'public', table: 'map_locations' }, (p: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      dispatchToSubscribers('map_locations', p.eventType, p.new, p.old)
    })
    .on('postgres_changes', { event: '*' as const, schema: 'public', table: 'pending_events' }, (p: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      dispatchToSubscribers('pending_events', p.eventType, p.new, p.old)
    })
    .subscribe()
}

function destroyChannelIfEmpty() {
  if (activeSubCount > 0 || !channel) return
  supabase.removeChannel(channel)
  channel = null
}

export function useSubscription(
  table: TableName,
  colonyId: string | null,
  callback: (payload: ChangePayload) => void,
  enabled = true,
) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!enabled || !colonyId) return

    const sub: Subscriber = { table, colonyId, callback: (p) => callbackRef.current(p) }
    subscribers.push(sub)
    activeSubCount++
    ensureChannel()

    return () => {
      const idx = subscribers.indexOf(sub)
      if (idx >= 0) subscribers.splice(idx, 1)
      activeSubCount--
      destroyChannelIfEmpty()
    }
  }, [table, colonyId, enabled])
}
