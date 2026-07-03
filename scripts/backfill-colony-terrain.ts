import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { generateColonyTerrain } from '../src/domains/colony/colony-terrain.generator'

function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return

  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const [key, ...values] = line.split('=')
    if (!key || values.length === 0 || process.env[key.trim()]) return
    process.env[key.trim()] = values.join('=').replace(/^"|"$/g, '').trim()
  })
}

async function main() {
  loadEnvFile()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: colonies, error } = await supabase
    .from('colonies')
    .select('id, terrain_grid')

  if (error) throw error

  const emptyColonies = (colonies || []).filter(colony => {
    const terrainGrid = colony.terrain_grid
    return !Array.isArray(terrainGrid) || terrainGrid.length === 0
  })

  for (const colony of emptyColonies) {
    const terrainGrid = generateColonyTerrain(colony.id)
    const { error: updateError } = await supabase
      .from('colonies')
      .update({ terrain_grid: terrainGrid })
      .eq('id', colony.id)

    if (updateError) throw updateError
    console.log(`Backfilled terrain for colony ${colony.id}`)
  }

  console.log(`Backfilled ${emptyColonies.length} colonies`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
