import type { LexiconGroup } from './signals-repo.js'

export function expandWithLexicon(text: string, lexicon: LexiconGroup[]): string {
  const lower = text.toLowerCase()
  const extra: string[] = []
  for (const group of lexicon) {
    if (group.terms.some(t => lower.includes(t.toLowerCase()))) {
      group.terms.forEach(t => { if (!lower.includes(t.toLowerCase())) extra.push(t) })
    }
  }
  return lower + (extra.length ? ' ' + extra.join(' ') : '')
}

// ── Lexicon families proposed by an AI (signal prompt, lexicon tools) ──
// Keep this block in sync with app/src/lib/lexicon/index.ts.

export const LEXICON_DOMAINS = ['general', 'dev', 'project', 'mental-health', 'spybee', 'custom'] as const

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

export function cleanTerms(terms: unknown): string[] {
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

export function describeUpsert(result: LexiconUpsertResult): string {
  const lines: string[] = []
  result.created.forEach(t => lines.push(`➕ nuevo grupo: ${t.join(', ')}`))
  result.extended.forEach(e => lines.push(`🔗 ${e.id} + ${e.added.join(', ')}`))
  result.skipped.forEach(s => lines.push(`⏭️ omitido (${s.reason}): ${s.terms.join(', ')}`))
  return lines.join('\n')
}
