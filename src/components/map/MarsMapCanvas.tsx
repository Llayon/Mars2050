'use client'

import { memo, useEffect, useRef, useState } from 'react'
import type { MapLocation } from '@/domains/map/map.types'
import { createMarsMapRuntime, type MarsMapRuntime } from './mars-map-runtime'

interface MarsMapCanvasProps {
  locations: MapLocation[]
  selectedLocation: MapLocation | null
  onSelectLocation: (loc: MapLocation | null) => void
}

export const MarsMapCanvas = memo(function MarsMapCanvas({
  locations,
  selectedLocation,
  onSelectLocation
}: MarsMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const runtimeRef = useRef<MarsMapRuntime | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    let isCancelled = false

    createMarsMapRuntime({
      container: containerRef.current,
      locations,
      selectedLocation,
      onSelectLocation
    })
      .then((runtime) => {
        if (isCancelled) {
          runtime.destroy()
          return
        }
        runtimeRef.current = runtime
        setLoading(false)
      })
      .catch((err) => {
        if (isCancelled) return
        console.error('Failed to initialize Mars map runtime:', err)
        setError(err instanceof Error ? err.message : 'Ошибка инициализации карты')
        setLoading(false)
      })

    return () => {
      isCancelled = true
      if (runtimeRef.current) {
        runtimeRef.current.destroy()
        runtimeRef.current = null
      }
    }
  }, []) // Initialize once on mount

  // Sync updated locations
  useEffect(() => {
    if (runtimeRef.current && !loading) {
      runtimeRef.current.updateLocations(locations)
    }
  }, [locations, loading])

  // Sync selected location
  useEffect(() => {
    if (runtimeRef.current && !loading) {
      runtimeRef.current.setSelectedLocation(selectedLocation)
    }
  }, [selectedLocation, loading])

  return (
    <div className="relative w-full h-[520px] rounded-xl overflow-hidden bg-[#0d0d11] border border-gray-800/80 shadow-2xl">
      <div ref={containerRef} className="w-full h-full" />

      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d0d11]/80 backdrop-blur-sm z-10">
          <div className="w-8 h-8 border-2 border-mars-teal border-t-transparent rounded-full animate-spin mb-2" />
          <span className="text-xs text-gray-400 font-medium">Загрузка ландшафта Марса...</span>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0d0d11]/90 p-4 text-center z-10">
          <p className="text-xs text-red-400 font-semibold">{error}</p>
        </div>
      )}
    </div>
  )
})
