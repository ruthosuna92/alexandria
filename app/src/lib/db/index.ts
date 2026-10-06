import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!

// Auto-generated project summaries written by the MCP server live in `signals`
// with this contexto. Lists and stats exclude them; search keeps them.
export const OVERVIEW_CONTEXTO = 'overview'

let _client: ReturnType<typeof createClient<any>> | null = null

export function getDb() {
  if (_client) return _client
  _client = createClient(supabaseUrl, supabaseKey)
  return _client
}