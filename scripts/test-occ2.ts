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

async function testOCC() {
  const colonyId = '23d0fa7d-1c7e-4ba3-ba77-87ab76098623'
  
  const { data: res } = await supabase.from('resources').select('type, amount').eq('colony_id', colonyId)
  console.log('Current resources:', res)

  const min = res.find(r => r.type === 'minerals')
  if (!min) return console.log('No minerals')

  const currentAmount = min.amount
  const newAmount = currentAmount - 80

  console.log(`Trying to update minerals to ${newAmount} where amount = ${currentAmount}`)
  const { data: updated, error } = await supabase
    .from('resources')
    .update({ amount: newAmount })
    .eq('colony_id', colonyId)
    .eq('type', 'minerals')
    .eq('amount', currentAmount)
    .select('id')

  console.log('Update result:', updated, error)
  
  if (updated && updated.length > 0) {
      console.log('Reverting...')
      await supabase.from('resources').update({ amount: currentAmount }).eq('id', updated[0].id)
  }
}

testOCC()
