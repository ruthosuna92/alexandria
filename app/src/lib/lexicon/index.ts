import { getDb } from '@/lib/db'

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