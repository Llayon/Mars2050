import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { loadEnvConfig } from '@next/env'

const projectDir = process.cwd()
loadEnvConfig(projectDir)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  console.log('Adding 5000 resources to all colonies...')
  
  // First, get all colonies
  const { data: colonies, error: coloniesError } = await supabase.from('colonies').select('id')
  if (coloniesError || !colonies) {
    console.error('Error fetching colonies:', coloniesError)
    process.exit(1)
  }

  console.log(`Found ${colonies.length} colonies.`)

  // Add resources for each colony
  for (const colony of colonies) {
    const { data: resources, error: resourcesError } = await supabase
      .from('resources')
      .select('*')
      .eq('colony_id', colony.id)

    if (resourcesError) {
      console.error(`Error fetching resources for colony ${colony.id}:`, resourcesError)
      continue
    }

    const updates = resources.map(res => {
      return supabase
        .from('resources')
        .update({ amount: res.amount + 5000 })
        .eq('id', res.id)
    })

    await Promise.all(updates)
    console.log(`✅ Gave 5000 resources to colony ${colony.id}`)
  }

  console.log('Done!')
}

run()
