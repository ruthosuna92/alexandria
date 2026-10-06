import { getDb } from '@/lib/db'
import { LEXICON_DOMAINS } from './domains'

export interface LexiconGroup {
  id: string
  terms: string[]
  domain: string
  langs: string[]
}

export async function getLexicon(): Promise<LexiconGroup[]> {
  const db = getDb()
  const { data, error } = await db
    .from('lexicon')
    .select('id, terms, domain, langs')
    .order('domain')
  if (error || !data) return []
  return data.map(r => ({
    id: r.id,
    terms: r.terms as string[],
    domain: r.domain,
    langs: r.langs as string[]
  }))
}

export async function addLexiconGroup(group: Omit<LexiconGroup, 'id'>): Promise<LexiconGroup> {
  const db = getDb()
  const id = 'lex_' + Date.now().toString(36)
  const { error } = await db
    .from('lexicon')
    .insert({ id, terms: group.terms, domain: group.domain, langs: group.langs })
  if (error) throw new Error(error.message)
  return { id, ...group }
}

export async function deleteLexiconGroup(id: string) {
  const db = getDb()
  const { error } = await db.from('lexicon').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export function expandWithLexicon(text: string, lexicon: LexiconGroup[]): string {
  const lower = text.toLowerCase()
  const extra: string[] = []
  for (const group of lexicon) {
    const hit = group.terms.some(t => lower.includes(t.toLowerCase()))
    if (hit) group.terms.forEach(t => { if (!lower.includes(t.toLowerCase())) extra.push(t) })
  }
  return lower + (extra.length ? ' ' + extra.join(' ') : '')
}

// ── Lexicon families proposed by an AI (signal prompt, lexicon prompt, MCP) ──
// Keep this block in sync with mcp/lib/lexicon.ts + mcp/lib/signals-repo.ts.

export { LEXICON_DOMAINS }

// expandWithLexicon matches by substring, so short terms ("app", "db") would
// expand almost any text. New terms must be at least this long.
export const MIN_TERM_LENGTH = 4

export const LEXICON_RULES = `Reglas para "lexicon":
- Solo familias reales de palabras: sinónimos, traducciones (es/en), alias y abreviaturas del mismo concepto.
- NO agrupes cosas que solo aparecieron juntas (ej: "breadcrumbs" y "Next.js" no son sinónimos).
- Mínimo 2 términos por grupo, cada término de al menos ${MIN_TERM_LENGTH} caracteres.
- domain: ${LEXICON_DOMAINS.join(' | ')}. Usa "project" para los nombres/alias de un mismo proyecto o repo.
- Si un término ya existe en el lexicon actual, repite ese término y agrega solo los nuevos: se fusionan en el mismo grupo.
- Máximo 3 grupos. Si no hay nada que valga la pena, usa [].`

export interface LexiconInput {
  terms: string[]
  domain?: string
  langs?: string[]
}

export interface LexiconUpsertResult {
  created: string[][]
  extended: { id: string; added: string[] }[]
  skipped: { terms: string[]; reason: string }[]
}

/** One line per group, compact enough to embed in a prompt. */
export function formatLexiconForPrompt(lexicon: LexiconGroup[]): string {
  if (!lexicon.length) return '(vacío)'
  return lexicon.map(g => `- [${g.domain}] ${g.terms.join(', ')}`).join('\n')
}

function cleanTerms(terms: unknown): string[] {
  if (!Array.isArray(terms)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of terms) {
    if (typeof raw !== 'string') continue
    const term = raw.trim()
    const key = term.toLowerCase()
    if (term.length < MIN_TERM_LENGTH || seen.has(key)) continue
    seen.add(key)
    out.push(term)
  }
  return out
}

/**
 * Saves AI-proposed families. A group that shares any term (case-insensitive)
 * with an existing group extends that group; otherwise it becomes a new group.
 */
export async function upsertLexiconGroups(inputs: LexiconInput[]): Promise<LexiconUpsertResult> {
  const result: LexiconUpsertResult = { created: [], extended: [], skipped: [] }
  if (!Array.isArray(inputs) || !inputs.length) return result

  const db = getDb()
  const { data, error } = await db.from('lexicon').select('id, terms, domain, langs')
  if (error) throw new Error(`loading lexicon failed: ${error.message}`)
  const lexicon = (data || []) as LexiconGroup[]

  for (const input of inputs) {
    const terms = cleanTerms(input?.terms)
    const langs = Array.isArray(input?.langs) ? input.langs.filter(l => typeof l === 'string') : []
    if (terms.length < 2) {
      result.skipped.push({ terms: Array.isArray(input?.terms) ? input.terms : [], reason: `needs 2+ terms of ${MIN_TERM_LENGTH}+ chars` })
      continue
    }

    const lowered = new Set(terms.map(t => t.toLowerCase()))
    const match = lexicon.find(g => g.terms.some(t => lowered.has(t.toLowerCase())))

    if (match) {
      const existing = new Set(match.terms.map(t => t.toLowerCase()))
      const added = terms.filter(t => !existing.has(t.toLowerCase()))
      if (!added.length) {
        result.skipped.push({ terms, reason: `already in ${match.id}` })
        continue
      }
      match.terms = [...match.terms, ...added]
      match.langs = [...new Set([...(match.langs || []), ...langs])]
      const { error: updateError } = await db.from('lexicon')
        .update({ terms: match.terms, langs: match.langs })
        .eq('id', match.id)
      if (updateError) throw new Error(`extending ${match.id} failed: ${updateError.message}`)
      result.extended.push({ id: match.id, added })
      continue
    }

    const domain = (LEXICON_DOMAINS as readonly string[]).includes(input.domain ?? '') ? input.domain! : 'general'
    const id = 'lex_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
    const { error: insertError } = await db.from('lexicon').insert({ id, terms, domain, langs })
    if (insertError) throw new Error(`creating lexicon group failed: ${insertError.message}`)
    lexicon.push({ id, terms, domain, langs })
    result.created.push(terms)
  }

  return result
}
