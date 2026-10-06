import { expandWithLexicon } from './lexicon.js'
import { embed } from './embedding.js'
import {
  countProjectSignals,
  getLexicon,
  listSignals,
  upsertOverview,
  OVERVIEW_CONTEXTO,
} from './signals-repo.js'

const OVERVIEW_EVERY_N_SIGNALS = 3
const OVERVIEW_SOURCE_LIMIT = 30

/** Regenerates the overview every N signals. Returns true when it ran. */
export async function maybeGenerateOverview(proyecto: string): Promise<boolean> {
  const count = await countProjectSignals(proyecto)
  if (count < OVERVIEW_EVERY_N_SIGNALS || count % OVERVIEW_EVERY_N_SIGNALS !== 0) return false

  await generateOverview(proyecto)
  return true
}

function mostFrequent(values: string[], fallback: string): string {
  const counts = new Map<string, number>()
  for (const v of values) if (v) counts.set(v, (counts.get(v) || 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || fallback
}

export async function generateOverview(proyecto: string) {
  const signals = (await listSignals({ proyecto }))
    .filter(s => s.contexto !== OVERVIEW_CONTEXTO)
    .slice(0, OVERVIEW_SOURCE_LIMIT)

  if (!signals.length) return

  const stack             = [...new Set(signals.flatMap(s => s.stack || []))]
  const decisiones        = [...new Set(signals.flatMap(s => s.decisiones || []))]
  const preferencias      = [...new Set(signals.flatMap(s => s.preferencias || []))]
  const errores_resueltos = [...new Set(signals.flatMap(s => s.errores_resueltos || []))]
  const modelo = mostFrequent(signals.map(s => s.modelo), 'claude-sonnet-5-5')
  const skill  = mostFrequent(signals.map(s => s.skill), 'nextjs.md')

  // Project name and "overview" are repeated so this row ranks first for
  // broad "what is project X" queries.
  const lexicon = await getLexicon()
  const textForVector = expandWithLexicon(
    [
      proyecto, proyecto, proyecto,
      'overview', 'overview', 'overview',
      ...stack,
      ...decisiones.slice(0, 10),
      ...preferencias,
    ].join(' '),
    lexicon
  )
  const embedding = await embed(textForVector)

  await upsertOverview({
    proyecto,
    tema: 'arquitectura',
    stack,
    decisiones,
    preferencias,
    errores_resueltos,
    modelo,
    skill,
    embedding,
  })
}
