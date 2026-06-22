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

async function checkDB() {
  const { data: buildings, error } = await supabase
    .from('buildings')
    .select('id, type, x, y, created_at')
    .eq('type', 'solar_panels')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('Error fetching buildings:', error)
    return
  }

  console.log('Recent solar panels in DB:')
  buildings.forEach(b => console.log(`- ID: ${b.id}, Cell: (${b.x}, ${b.y}), Time: ${b.created_at}`))
}

checkDB()
