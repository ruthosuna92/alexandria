import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!

let _client: ReturnType<typeof createClient<any>> | null = null

export function getDb() {
  if (_client) return _client
  _client = createClient(supabaseUrl, supabaseKey)
  return _client
}