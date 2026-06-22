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

async function confirmEmails() {
  const { data: users, error } = await supabase.auth.admin.listUsers()
  if (error) {
    console.error('Error fetching users:', error)
    return
  }

  console.log('All users:')
  for (const user of users.users) {
    console.log(`- ${user.email} (confirmed: ${!!user.email_confirmed_at})`)
    if (!user.email_confirmed_at) {
      await supabase.auth.admin.updateUserById(user.id, { email_confirm: true })
      console.log(`  -> Confirmed now!`)
      count++
    }
  }
  console.log(`Auto-confirmed ${count} users.`)
}

confirmEmails()
