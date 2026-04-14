import { getDb, persist } from '@/lib/db'

export interface LexiconGroup {
  id: string
  terms: string[]
  domain: string
  langs: string[]
}

export async function getLexicon(): Promise<LexiconGroup[]> {
  const db = await getDb()
  const res = db.exec('SELECT id, terms, domain, langs FROM lexicon ORDER BY domain, id')
  if (!res.length) return []
  return res[0].values.map((row: any[]) => ({
    id: row[0],
    terms: JSON.parse(row[1]),
    domain: row[2],
    langs: JSON.parse(row[3])
  }))
}

export async function addLexiconGroup(group: Omit<LexiconGroup, 'id'>): Promise<LexiconGroup> {
  const db = await getDb()
  const id = 'lex_' + Date.now().toString(36)
  db.run('INSERT INTO lexicon (id, terms, domain, langs) VALUES (?, ?, ?, ?)',
    [id, JSON.stringify(group.terms), group.domain, JSON.stringify(group.langs)])
  persist(db)
  return { id, ...group }
}

export async function deleteLexiconGroup(id: string) {
  const db = await getDb()
  db.run('DELETE FROM lexicon WHERE id = ?', [id])
  persist(db)
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
