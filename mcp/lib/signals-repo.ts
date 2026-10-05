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

export async function insertSignal(signal: NewSignal): Promise<void> {
  const { error } = await getSupabase().from('signals').insert(signal)
  if (error) throw new Error(`inserting signal failed: ${error.message}`)
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
