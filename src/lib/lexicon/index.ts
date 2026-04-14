import { getDb } from '@/lib/db'

export interface LexiconGroup {
  id: string
  terms: string[]
  domain: string
  langs: string[]
}

export function getLexicon(): LexiconGroup[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM lexicon ORDER BY domain, id').all() as any[]
  return rows.map(r => ({
    id: r.id,
    terms: JSON.parse(r.terms),
    domain: r.domain,
    langs: JSON.parse(r.langs)
  }))
}

export function addLexiconGroup(group: Omit<LexiconGroup, 'id'>): LexiconGroup {
  const db = getDb()
  const id = 'lex_' + Date.now().toString(36)
  db.prepare('INSERT INTO lexicon (id, terms, domain, langs) VALUES (?, ?, ?, ?)').run(
    id, JSON.stringify(group.terms), group.domain, JSON.stringify(group.langs)
  )
  return { id, ...group }
}

export function deleteLexiconGroup(id: string) {
  const db = getDb()
  db.prepare('DELETE FROM lexicon WHERE id = ?').run(id)
}

export function expandWithLexicon(text: string, lexicon: LexiconGroup[]): string {
  const lower = text.toLowerCase()
  const extra: string[] = []
  for (const group of lexicon) {
    const hit = group.terms.some(t => lower.includes(t.toLowerCase()))
    if (hit) {
      group.terms.forEach(t => {
        if (!lower.includes(t.toLowerCase())) extra.push(t)
      })
    }
  }
  return lower + (extra.length ? ' ' + extra.join(' ') : '')
}
