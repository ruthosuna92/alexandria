// The only module that reads or writes Alexandria data. Tools and the arbiter
// go through these functions so they never depend on how storage works.
import { getSupabase } from './supabase.js'

export interface SignalRow {
  id: string
  proyecto: string
  contexto: string
  tema: string
  stack: string[]
  decisiones: string[]
  preferencias: string[]
  errores_resueltos: string[]
  modelo: string
  skill: string
  fecha: string
  created_at: string
}

export interface SignalFilters {
  proyecto?: string
  tema?: string
  stack?: string
}

export interface NewSignal {
  id: string
  proyecto: string
  contexto: string
  tema: string
  stack: string[]
  decisiones: string[]
  preferencias: string[]
  errores_resueltos: string[]
  modelo: string
  skill: string
  fecha: string
  embedding: number[]
}

export interface LexiconGroup {
  id: string
  terms: string[]
  domain: string
  langs: string[]
}

const SIGNAL_COLUMNS =
  'id,proyecto,contexto,tema,stack,decisiones,preferencias,errores_resueltos,modelo,skill,fecha,created_at'

/**
 * Nearest signals by embedding via the `match_signals` RPC. The RPC takes no
 * filters, so callers needing filtered results should intersect with listSignals().
 */
export async function searchSignals(vector: number[], topK: number): Promise<Array<{ id: string; score: number }>> {
  const { data, error } = await getSupabase().rpc('match_signals', {
    query_embedding: vector,
    match_count: topK,
  })
  if (error) throw new Error(`match_signals failed: ${error.message}`)
  return (data || []).map((r: { id: string; similarity: number }) => ({ id: r.id, score: r.similarity }))
}

/** Signals matching the filters, newest first. */
export async function listSignals(filters: SignalFilters = {}): Promise<SignalRow[]> {
  let query = getSupabase().from('signals').select(SIGNAL_COLUMNS)
  if (filters.proyecto) query = query.eq('proyecto', filters.proyecto)
  if (filters.tema)     query = query.eq('tema', filters.tema)

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw new Error(`listing signals failed: ${error.message}`)

  const rows = (data || []) as SignalRow[]
  if (!filters.stack) return rows

  // Case-insensitive partial match, same behavior as the old SQLite `stack LIKE %x%`.
  const needle = filters.stack.toLowerCase()
  return rows.filter(r => (r.stack || []).some(s => s.toLowerCase().includes(needle)))
}

/**
 * Returns the existing spelling of a project name, matched case-insensitively,
 * so "spybee" is saved as "Spybee" when that already exists. When several
 * spellings exist, the most used one wins. Unknown projects are returned trimmed.
 */
export async function resolveProjectName(proyecto: string): Promise<string> {
  const trimmed = proyecto.trim()
  const { data, error } = await getSupabase().from('signals').select('proyecto')
  if (error) throw new Error(`listing projects failed: ${error.message}`)

  const counts = new Map<string, number>()
  for (const row of (data || []) as Array<{ proyecto: string }>) {
    if (row.proyecto.toLowerCase() === trimmed.toLowerCase()) {
      counts.set(row.proyecto, (counts.get(row.proyecto) || 0) + 1)
    }
  }

  // Ties break by code point order, which puts capitalized spellings first
  // ("Alexandria" over "alexandria").
  const [mostUsed] = [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
  return mostUsed ? mostUsed[0] : trimmed
}

export async function insertSignal(signal: NewSignal): Promise<void> {
  const { error } = await getSupabase().from('signals').insert(signal)
  if (error) throw new Error(`inserting signal failed: ${error.message}`)
}

export const OVERVIEW_CONTEXTO = 'overview'

/** Number of real (non-overview) signals in a project. */
export async function countProjectSignals(proyecto: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from('signals')
    .select('*', { count: 'exact', head: true })
    .eq('proyecto', proyecto)
    .neq('contexto', OVERVIEW_CONTEXTO)
  if (error) throw new Error(`counting signals failed: ${error.message}`)
  return count || 0
}

/**
 * Creates or replaces a project's overview row. The id is derived from the
 * project name, so concurrent regenerations from two MCP processes upsert the
 * same row instead of inserting duplicates.
 */
export async function upsertOverview(overview: Omit<NewSignal, 'id' | 'contexto' | 'fecha'>): Promise<void> {
  const { error } = await getSupabase()
    .from('signals')
    .upsert({
      ...overview,
      id: `ov_${overview.proyecto}`,
      contexto: OVERVIEW_CONTEXTO,
      fecha: new Date().toLocaleDateString('es-CO'),
      // Refreshed on every regeneration so the arbiter's recency score reflects it.
      created_at: new Date().toISOString(),
    }, { onConflict: 'id' })
  if (error) throw new Error(`saving overview failed: ${error.message}`)
}

export async function getLexicon(): Promise<LexiconGroup[]> {
  const { data, error } = await getSupabase()
    .from('lexicon')
    .select('id, terms, domain, langs')
    .order('domain')
  if (error) throw new Error(`loading lexicon failed: ${error.message}`)
  return (data || []) as LexiconGroup[]
}

export async function getModelState(key: string): Promise<string | null> {
  const { data, error } = await getSupabase()
    .from('model_state')
    .select('value')
    .eq('key', key)
    .maybeSingle()
  if (error) throw new Error(`loading model_state "${key}" failed: ${error.message}`)
  return data?.value ?? null
}
