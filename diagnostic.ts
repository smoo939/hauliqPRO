// diagnostic.ts
import { createClient } from '@supabase/supabase-js'

// ✅ Load environment variables (Vite uses import.meta.env)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase environment variables.')
  console.error('Make sure .env.local contains:')
  console.error('  VITE_SUPABASE_URL=your_url')
  console.error('  VITE_SUPABASE_ANON_KEY=your_key')
  process.exit(1)
}

console.log('✅ Supabase environment variables loaded.')
console.log(`   URL: ${SUPABASE_URL}`)

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function runDiagnostics() {
  console.log('\n🔍 Running Supabase Diagnostics...\n')

  // 🔹 1. Check Supabase connection
  try {
    console.log('📌 Test 1: Supabase Connection')
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      console.error('❌ Auth session error:', sessionError.message)
    } else if (session) {
      console.log('✅ Authenticated as:', session.user.email)
    } else {
      console.log('⚠️  No active session (expected for unauthenticated test)')
    }
  } catch (err) {
    console.error('❌ Failed to check session:', err)
  }

  // 🔹 2. Check RLS policies on 'loads' table
  try {
    console.log('\n📌 Test 2: RLS Policies on "loads" table')
    const { data, error, status } = await supabase.from('loads').select('*').limit(1)
    
    if (error) {
      if (error.message.includes('RLS') || error.message.includes('permission')) {
        console.error('❌ RLS is blocking access to loads.')
        console.error('   Error:', error.message)
        console.error('   Solution: Check Supabase → Loads table → RLS policies')
      } else if (error.message.includes('relation "loads" does not exist')) {
        console.error('❌ "loads" table does not exist in database.')
        console.error('   Solution: Create the table or check schema.')
      } else {
        console.error('❌ Query error:', error.message)
      }
    } else {
      console.log(`✅ Successfully queried loads table. Found ${data?.length || 0} rows.`)
    }
  } catch (err) {
    console.error('❌ Unexpected error querying loads:', err)
  }

  // 🔹 3. Check RLS policies on 'bids' table
  try {
    console.log('\n📌 Test 3: RLS Policies on "bids" table')
    const { data, error } = await supabase.from('bids').select('*').limit(1)
    
    if (error) {
      if (error.message.includes('RLS') || error.message.includes('permission')) {
        console.error('❌ RLS is blocking access to bids.')
        console.error('   Error:', error.message)
      } else if (error.message.includes('relation "bids" does not exist')) {
        console.error('❌ "bids" table does not exist in database.')
      } else {
        console.error('❌ Query error:', error.message)
      }
    } else {
      console.log(`✅ Successfully queried bids table. Found ${data?.length || 0} rows.`)
    }
  } catch (err) {
    console.error('❌ Unexpected error querying bids:', err)
  }

  // 🔹 4. Check Supabase Auth configuration
  try {
    console.log('\n📌 Test 4: Auth Configuration')
    const { data: { providers }, error: providersError } = await supabase.auth.listFactors()
    
    if (!providersError) {
      console.log('✅ Auth system is accessible.')
    } else {
      console.warn('⚠️  Could not fetch auth factors:', providersError.message)
    }
  } catch (err) {
    console.log('⚠️  Auth configuration check skipped (may require full setup)')
  }

  // 🔹 5. Check database URL connectivity
  console.log('\n📌 Test 5: Environment Variables')
  const DATABASE_URL = import.meta.env.VITE_DATABASE_URL
  if (DATABASE_URL) {
    console.log('✅ DATABASE_URL is configured')
  } else {
    console.warn('⚠️  DATABASE_URL not found in .env.local (optional for client-side)')
  }

  // 🔹 6. Test local storage
  try {
    console.log('\n📌 Test 6: Local Storage')
    localStorage.setItem('diagnostic_test', 'ok')
    const value = localStorage.getItem('diagnostic_test')
    if (value === 'ok') {
      console.log('✅ Local storage is working')
      localStorage.removeItem('diagnostic_test')
    } else {
      console.error('❌ Local storage test failed')
    }
  } catch (err) {
    console.error('❌ Local storage error:', err)
  }

  console.log('\n✅ Diagnostics complete!\n')
}

// Run diagnostics
runDiagnostics().catch(err => {
  console.error('❌ Diagnostics failed:', err)
  process.exit(1)
})
