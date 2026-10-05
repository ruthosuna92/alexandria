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
