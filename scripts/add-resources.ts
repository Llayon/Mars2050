import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function run() {
  console.log('Adding resources to all colonies...')
  const { error } = await supabase
    .from('resources')
    .update({ amount: 50000 })
    .gte('amount', 0) // dummy condition to update all rows
    
  if (error) {
    console.error('Error updating resources:', error)
  } else {
    console.log('Successfully updated resources to 50000!')
  }
}

run()
