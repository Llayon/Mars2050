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

async function check() {
  const { data, error } = await supabase.from('resources').select('*').eq('colony_id', '23d0fa7d-1c7e-4ba3-ba77-87ab76098623').eq('type', 'minerals')
  console.log('Minerals rows:', data?.length)
  if (data) {
    data.forEach(d => console.log(d.id, d.amount))
  }
}
check()
