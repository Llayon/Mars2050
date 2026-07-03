'use client'

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

type TableName = 'resources' | 'events' | 'buildings' | 'map_locations' | 'pending_events' | 'work_orders' | 'population'

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

type ChannelEntry = {
  channel: ReturnType<typeof supabase.channel>
  subscribers: Subscriber[]
}

const channels = new Map<string, ChannelEntry>()

function channelKey(table: TableName, colonyId: string): string {
  return `${table}:${colonyId}`
}

function createChannelEntry(table: TableName, colonyId: string): ChannelEntry {
  const subscribers: Subscriber[] = []
  const channel = supabase
    .channel(`mars2050-sync-${table}-${colonyId}`)
    .on(
      'postgres_changes',
      { event: '*' as const, schema: 'public', table, filter: `colony_id=eq.${colonyId}` },
      (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
        for (const sub of subscribers) {
          sub.callback({ table, eventType: payload.eventType, new: payload.new, old: payload.old })
        }
      }
    )
    .subscribe()

  return { channel, subscribers }
}

export function useSubscription(
  table: TableName,
  colonyId: string | null,
  callback: (payload: ChangePayload) => void,
  enabled = true,
) {
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  })

  useEffect(() => {
    if (!enabled || !colonyId) return

    const sub: Subscriber = { table, colonyId, callback: (p) => callbackRef.current(p) }
    const key = channelKey(table, colonyId)
    let entry = channels.get(key)
    if (!entry) {
      entry = createChannelEntry(table, colonyId)
      channels.set(key, entry)
    }
    entry.subscribers.push(sub)

    return () => {
      const currentEntry = channels.get(key)
      if (!currentEntry) return
      const idx = currentEntry.subscribers.indexOf(sub)
      if (idx >= 0) currentEntry.subscribers.splice(idx, 1)
      if (currentEntry.subscribers.length === 0) {
        channels.delete(key)
        supabase.removeChannel(currentEntry.channel)
      }
    }
  }, [table, colonyId, enabled])
}
