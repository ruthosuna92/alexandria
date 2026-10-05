import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { config } from './config.js'

let _client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (_client) return _client
  _client = createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { persistSession: false },
  })
  return _client
}
