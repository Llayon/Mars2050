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

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
  const { data: profiles } = await supabase.from('profiles').select('id, username, email')
  const { data: colonies } = await supabase.from('colonies').select('id, user_id, name')
  const { data: resources, error } = await supabase.from('resources').select('colony_id, type, amount')
  if (error) console.error('Error fetching resources:', error)

  console.log('--- PROFILES ---')
  console.log(profiles)
  console.log('--- COLONIES ---')
  console.log(colonies)
  
  console.log('--- RESOURCES ---')
  const resByColony: Record<string, {type: string, amount: number}[]> = {}
  resources?.forEach(r => {
    if (!resByColony[r.colony_id]) resByColony[r.colony_id] = []
    resByColony[r.colony_id].push({ type: r.type, amount: r.amount })
  })
  console.log(JSON.stringify(resByColony, null, 2))
}

check()
