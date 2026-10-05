import { cosineSim, embed } from './embedding.js'
import { expandWithLexicon } from './lexicon.js'
import { getLexicon, listSignals, searchSignals, SignalRow } from './signals-repo.js'

export type Signal = SignalRow

export interface ArbiterResult {
  mode: 'single' | 'combined' | 'none'
  signals: Signal[]
  reason: string
  context: string
}

// Words that join two distinct topics. "con" / "junto" are left out on purpose:
// "bug con Supabase" is one topic, not two.
const COMPOUND_CONNECTORS = [
  'y', 'e', 'and', '&', '+', 'plus',
  'también', 'tambien', 'además', 'ademas', 'así como', 'asi como',
]

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function detectCompoundQuery(q: string): { isCompound: boolean; parts: string[] } {
  for (const connector of COMPOUND_CONNECTORS) {
    // Whole words only (surrounded by whitespace), so "Spybee" or "Alexandria"
    // never split on the "y" / "and" inside them.
    const match = new RegExp(`\\s${escapeRegExp(connector)}\\s`, 'i').exec(q)
    if (!match) continue

    const before = q.slice(0, match.index).trim()
    const after  = q.slice(match.index + match[0].length).trim()
    if (before.length > 2 && after.length > 2) {
      return { isCompound: true, parts: [before, after] }
    }
  }
  return { isCompound: false, parts: [q] }
}

function scoreSignal(signal: Signal, query: string, queryTokens: string[], proyecto?: string, tema?: string, stack?: string): number {
  let score = 0

  const hay = [signal.proyecto, signal.contexto, signal.tema, ...signal.stack, ...signal.decisiones].join(' ').toLowerCase()
  const textMatch = queryTokens.filter(t => hay.includes(t)).length / (queryTokens.length || 1)
  score += textMatch * 0.25

  if (proyecto && signal.proyecto === proyecto) score += 0.20
  if (tema && signal.tema === tema) score += 0.10
  if (stack && signal.stack.some(s => s.toLowerCase().includes(stack.toLowerCase()))) score += 0.05

  const now = Date.now()
  const signalDate = new Date(signal.created_at).getTime() || now
  const daysDiff = Math.max(0, (now - signalDate) / (1000 * 60 * 60 * 24))
  const recency = Math.max(0, 1 - daysDiff / 90)
  score += recency * 0.05

  return Math.min(score, 1)
}

async function fetchCandidates(subQuery: string, proyecto?: string, tema?: string, stack?: string): Promise<Array<Signal & { vectorScore: number; compositeScore: number }>> {
  const lexicon = await getLexicon()

  const expanded = expandWithLexicon(subQuery, lexicon)
  const qvec = await embed(expanded)
  const [vectorResults, signals] = await Promise.all([
    searchSignals(qvec, 15),
    listSignals({ proyecto, tema, stack }),
  ])
  if (!signals.length) return []

  const tokens = expanded.toLowerCase().split(/\W+/).filter((w: string) => w.length > 2)

  return signals.map(signal => {
    const vectorScore = vectorResults.find(v => v.id === signal.id)?.score || 0
    const textScore   = scoreSignal(signal, subQuery, tokens, proyecto, tema, stack)
    const compositeScore = vectorScore * 0.35 + textScore

    return { ...signal, vectorScore, compositeScore }
  })
  .filter(s => s.compositeScore > 0.10 || s.vectorScore > 0.30)
  .sort((a, b) => b.compositeScore - a.compositeScore)
  .slice(0, 8)
}

function buildContextBlock(signal: Signal, label?: string): string {
  const lines: string[] = []
  if (label) lines.push(`### ${label}`)
  lines.push(`## Contexto — ${signal.proyecto}`)
  if (signal.contexto) lines.push(`tarea: ${signal.contexto}`)
  if (signal.stack?.length) lines.push(`stack: ${signal.stack.join(', ')}`)
  if (signal.decisiones?.length)       { lines.push(''); lines.push('decisiones:');    signal.decisiones.forEach(d => lines.push(`  - ${d}`)) }
  if (signal.preferencias?.length)     { lines.push(''); lines.push('preferencias:');  signal.preferencias.forEach(x => lines.push(`  - ${x}`)) }
  if (signal.errores_resueltos?.length){ lines.push(''); lines.push('resuelto:');      signal.errores_resueltos.forEach(e => lines.push(`  - ${e}`)) }
  if (signal.modelo) { lines.push(''); lines.push(`modelo: ${signal.modelo}`) }
  if (signal.skill)  lines.push(`skill: ${signal.skill}`)
  return lines.join('\n')
}

export async function runArbiter(q: string, proyecto?: string, tema?: string, stack?: string): Promise<ArbiterResult> {
  const { isCompound, parts } = detectCompoundQuery(q)

  if (isCompound) {
    const [candidatesA, candidatesB] = await Promise.all([
      fetchCandidates(parts[0], proyecto, tema, stack),
      fetchCandidates(parts[1], proyecto, tema, stack),
    ])

    const bestA = candidatesA[0]
    const bestB = candidatesB[0]

    if (!bestA && !bestB) {
      return { mode: 'none', signals: [], reason: 'no hay contexto relevante para ninguna parte de la query', context: '' }
    }

    if (!bestA || bestA.compositeScore < 0.35) {
      return {
        mode: 'single', signals: [bestB!],
        reason: `query compuesta pero solo encontré contexto para "${parts[1]}"`,
        context: buildContextBlock(bestB!)
      }
    }

    if (!bestB || bestB.compositeScore < 0.35) {
      return {
        mode: 'single', signals: [bestA],
        reason: `query compuesta pero solo encontré contexto para "${parts[0]}"`,
        context: buildContextBlock(bestA)
      }
    }

    if (bestA.id === bestB.id) {
      return {
        mode: 'single', signals: [bestA],
        reason: 'ambas partes apuntan al mismo signal',
        context: buildContextBlock(bestA)
      }
    }

    const [vecA, vecB] = await Promise.all([embed(parts[0]), embed(parts[1])])
    const similarity = cosineSim(vecA, vecB)

    if (similarity > 0.40) {
      const winner = bestA.compositeScore >= bestB.compositeScore ? bestA : bestB
      return {
        mode: 'single', signals: [winner],
        reason: `signals demasiado parecidos (coseno ${similarity.toFixed(2)}), uso solo el mejor`,
        context: buildContextBlock(winner)
      }
    }

    return {
      mode: 'combined', signals: [bestA, bestB],
      reason: `query compuesta — "${parts[0]}" y "${parts[1]}" son temas distintos (coseno ${similarity.toFixed(2)})`,
      context: [
        buildContextBlock(bestA, parts[0]),
        '',
        '---',
        '',
        buildContextBlock(bestB, parts[1])
      ].join('\n')
    }
  }

  const candidates = await fetchCandidates(q, proyecto, tema, stack)

  if (!candidates.length || candidates[0].compositeScore < 0.35) {
    return { mode: 'none', signals: [], reason: 'score muy bajo — no hay contexto suficientemente relevante', context: '' }
  }

  const best   = candidates[0]
  const second = candidates[1]

  if (!second || best.compositeScore - second.compositeScore > 0.20) {
    return {
      mode: 'single', signals: [best],
      reason: `ganador claro (score ${best.compositeScore.toFixed(2)} vs ${second?.compositeScore.toFixed(2) || 'ninguno'})`,
      context: buildContextBlock(best)
    }
  }

  const [vecBest, vecSecond] = await Promise.all([
    embed([best.proyecto, best.contexto, ...best.decisiones].join(' ')),
    embed([second.proyecto, second.contexto, ...second.decisiones].join(' ')),
  ])
  const simBetween = cosineSim(vecBest, vecSecond)

  if (simBetween > 0.40) {
    return {
      mode: 'single', signals: [best],
      reason: `scores cercanos pero signals similares (coseno ${simBetween.toFixed(2)}), uso solo el mejor`,
      context: buildContextBlock(best)
    }
  }

  return {
    mode: 'combined', signals: [best, second],
    reason: `scores cercanos y signals distintos (coseno ${simBetween.toFixed(2)}) — combinando`,
    context: [
      buildContextBlock(best),
      '',
      '---',
      '',
      buildContextBlock(second)
    ].join('\n')
  }
}
