import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const envPath = path.resolve(process.cwd(), '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
const env: Record<string, string> = {}
envContent.split('\n').forEach(line => {
  const [key, ...vals] = line.split('=')
  if (key && vals.length > 0) {
    env[key.trim()] = vals.join('=').replace(/^"|"$/g, '').trim()
  }
})

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL']
const supabaseKey = env['SUPABASE_SERVICE_ROLE_KEY']

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixDB() {
  console.log('Fetching all buildings...')
  const { data: buildings, error } = await supabase.from('buildings').select('id, colony_id, x, y')
  if (error) {
    console.error('Error fetching buildings:', error)
    return
  }

  // Find duplicates
  const seen = new Set<string>()
  const toDelete = []

  for (const b of buildings) {
    if (b.x === null || b.y === null) continue
    const key = `${b.colony_id}_${b.x}_${b.y}`
    if (seen.has(key)) {
      toDelete.push(b.id)
    } else {
      seen.add(key)
    }
  }

  if (toDelete.length > 0) {
    console.log(`Found ${toDelete.length} duplicate buildings. Deleting...`)
    // Delete in chunks
    for (let i = 0; i < toDelete.length; i += 100) {
      const chunk = toDelete.slice(i, i + 100)
      const { error: delError } = await supabase.from('buildings').delete().in('id', chunk)
      if (delError) {
        console.error('Error deleting duplicates:', delError)
      }
    }
    console.log('Duplicates deleted.')
  } else {
    console.log('No duplicates found.')
  }

  // Now, how to add a unique constraint?
  // We can execute SQL using postgres function if available, but usually it's not exposed via standard REST.
  // Wait, Supabase REST API doesn't support raw SQL execution unless there's an RPC like `exec_sql`.
  // We cannot easily run `ALTER TABLE` from the JS client without an RPC!
}

fixDB()
