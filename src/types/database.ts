// Auto-generated from supabase-schema.sql
// Run `npx tsx scripts/generate-types.ts` to regenerate

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username?: string
          avatar_url?: string
          telegram_id?: number
          created_at?: string
          updated_at?: string
        }
        Insert: {
          username?: string
          avatar_url?: string
          telegram_id?: number
        }
        Update: {
          username?: string
          avatar_url?: string
          telegram_id?: number
          created_at?: string
          updated_at?: string
        }
      }
      colonies: {
        Row: {
          id?: string
          user_id: string
          name: string
          location_id?: string
          level?: number
          experience?: number
          created_at?: string
          updated_at?: string
        }
        Insert: {
          user_id: string
          name: string
          location_id?: string
          level?: number
          experience?: number
        }
        Update: {
          user_id?: string
          name?: string
          location_id?: string
          level?: number
          experience?: number
          created_at?: string
          updated_at?: string
        }
      }
      resources: {
        Row: {
          id?: string
          colony_id: string
          type: ResourcesType
          amount?: number
          production_rate?: number
          consumption_rate?: number
          updated_at?: string
        }
        Insert: {
          colony_id: string
          type: ResourcesType
          amount?: number
          production_rate?: number
          consumption_rate?: number
        }
        Update: {
          colony_id?: string
          type?: ResourcesType
          amount?: number
          production_rate?: number
          consumption_rate?: number
          updated_at?: string
        }
      }
      buildings: {
        Row: {
          id?: string
          colony_id: string
          type: string
          name: string
          level?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Insert: {
          colony_id: string
          type: string
          name: string
          level?: number
          is_active?: boolean
        }
        Update: {
          colony_id?: string
          type?: string
          name?: string
          level?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      map_locations: {
        Row: {
          id?: string
          name: string
          type: MapLocationsType
          x: number
          y: number
          difficulty: number
          resources?: Record<string, unknown>
          is_discovered?: boolean
          discovered_by?: string
          created_at?: string
        }
        Insert: {
          name: string
          type: MapLocationsType
          x: number
          y: number
          difficulty: number
          resources?: Record<string, unknown>
          is_discovered?: boolean
          discovered_by?: string
        }
        Update: {
          name?: string
          type?: MapLocationsType
          x?: number
          y?: number
          difficulty?: number
          resources?: Record<string, unknown>
          is_discovered?: boolean
          discovered_by?: string
          created_at?: string
        }
      }
      building_types: {
        Row: {
          type: string
          name: string
          base_cost: Record<string, unknown>
          base_production?: Record<string, unknown>
          base_consumption?: Record<string, unknown>
          build_time: number
          description?: string
        }
        Insert: {
          name: string
          base_cost: Record<string, unknown>
          base_production?: Record<string, unknown>
          base_consumption?: Record<string, unknown>
          build_time: number
          description?: string
        }
        Update: {
          name?: string
          base_cost?: Record<string, unknown>
          base_production?: Record<string, unknown>
          base_consumption?: Record<string, unknown>
          build_time?: number
          description?: string
        }
      }
      events: {
        Row: {
          id?: string
          colony_id: string
          type: EventsType
          name: string
          description: string
          effect?: Record<string, unknown>
          duration_minutes?: string
          is_active?: boolean
          created_at?: string
          ends_at?: string
        }
        Insert: {
          colony_id: string
          type: EventsType
          name: string
          description: string
          effect?: Record<string, unknown>
          duration_minutes?: string
          is_active?: boolean
          ends_at?: string
        }
        Update: {
          colony_id?: string
          type?: EventsType
          name?: string
          description?: string
          effect?: Record<string, unknown>
          duration_minutes?: string
          is_active?: boolean
          created_at?: string
          ends_at?: string
        }
      }
      pending_events: {
        Row: {
          id?: string
          colony_id: string
          type: PendingEventsType
          data?: Record<string, unknown>
          processed?: boolean
          processed_at?: string
          completes_at: string
          created_at?: string
        }
        Insert: {
          colony_id: string
          type: PendingEventsType
          data?: Record<string, unknown>
          processed?: boolean
          processed_at?: string
          completes_at: string
        }
        Update: {
          colony_id?: string
          type?: PendingEventsType
          data?: Record<string, unknown>
          processed?: boolean
          processed_at?: string
          completes_at?: string
          created_at?: string
        }
      }
      units: {
        Row: {
          id?: string
          colony_id: string
          unit_type: UnitsType
          tier?: number
          upgrade_path?: string[]
          hp_current: number
          grid_x?: string
          grid_y?: string
          created_at?: string
          updated_at?: string
        }
        Insert: {
          colony_id: string
          unit_type: UnitsType
          tier?: number
          upgrade_path?: string[]
          hp_current: number
          grid_x?: string
          grid_y?: string
        }
        Update: {
          colony_id?: string
          unit_type?: UnitsType
          tier?: number
          upgrade_path?: string[]
          hp_current?: number
          grid_x?: string
          grid_y?: string
          created_at?: string
          updated_at?: string
        }
      }
      battles: {
        Row: {
          id?: string
          attacker_colony_id: string
          defender_colony_id: string
          winner?: BattlesType
          attacker_units: Record<string, unknown>
          defender_units: Record<string, unknown>
          battle_log: Record<string, unknown>
          rewards?: Record<string, unknown>
          trophies_change?: Record<string, unknown>
          created_at?: string
        }
        Insert: {
          attacker_colony_id: string
          defender_colony_id: string
          winner?: BattlesType
          attacker_units: Record<string, unknown>
          defender_units: Record<string, unknown>
          battle_log: Record<string, unknown>
          rewards?: Record<string, unknown>
          trophies_change?: Record<string, unknown>
        }
        Update: {
          attacker_colony_id?: string
          defender_colony_id?: string
          winner?: BattlesType
          attacker_units?: Record<string, unknown>
          defender_units?: Record<string, unknown>
          battle_log?: Record<string, unknown>
          rewards?: Record<string, unknown>
          trophies_change?: Record<string, unknown>
          created_at?: string
        }
      }
    }
  }
}

export type ResourcesType = 'oxygen' | 'water' | 'energy' | 'minerals' | 'food' | 'research_points'
export type MapLocationsType = 'plains' | 'mountains' | 'canyon' | 'crater' | 'ice_cap'
export type EventsType = 'dust_storm' | 'meteor_shower' | 'anomaly_discovered' | 'resource_vein' | 'cold_wave' | 'solar_flare'
export type PendingEventsType = 'building_complete' | 'attack_arrive' | 'attack_return' | 'research_complete'
export type UnitsType = 'marine' | 'exosuit' | 'sniper' | 'medic' | 'rocketeer' | 'engineer' | 'wall' | 'turret' | 'alien_bug' | 'alien_spitter' | 'alien_worm'
export type BattlesType = 'attacker' | 'defender' | 'draw'