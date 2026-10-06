import { describeUpsert, formatLexiconForPrompt, LEXICON_RULES, type LexiconInput } from '../lib/lexicon.js'
import { getLexicon, upsertLexiconGroups } from '../lib/signals-repo.js'

export async function handleLexiconList() {
  const lexicon = await getLexicon()
  return {
    content: [{
      type: 'text' as const,
      text: `[Alexandria] Lexicon actual (${lexicon.length} grupos)\n${formatLexiconForPrompt(lexicon)}\n\n${LEXICON_RULES}`,
    }],
  }
}

export async function handleLexiconSave(args: { groups: LexiconInput[] }) {
  const result = await upsertLexiconGroups(args.groups)
  const summary = describeUpsert(result) || 'nada que guardar'
  return {
    content: [{ type: 'text' as const, text: `[Alexandria] Lexicon\n${summary}` }],
  }
}
