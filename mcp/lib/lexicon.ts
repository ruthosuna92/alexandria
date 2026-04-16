import { getDb } from './db.js'

export interface LexiconGroup {
  id: string; terms: string[]; domain: string; langs: string[]
}

export async function getLexicon(): Promise<LexiconGroup[]> {
  const db = await getDb()
  const res = db.exec('SELECT id, terms, domain, langs FROM lexicon ORDER BY domain')
  if (!res.length) return []
  return res[0].values.map((r: any[]) => ({
    id: r[0], terms: JSON.parse(r[1]), domain: r[2], langs: JSON.parse(r[3])
  }))
}

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
