import { getDb } from '@/lib/db'

export interface FeedbackEntry {
  tipo: 'copy' | 'delete' | 'ignore' | 'view'
  signal_id: string
  query?: string
  proyecto?: string
  tema?: string
  modelo?: string
  score_coseno?: number
}

export interface MergeFeedbackEntry {
  vector_a: number[]
  vector_b: number[]
  texto_a: string
  texto_b: string
  score_coseno: number
  proyecto?: string
  tema?: string
  usuario_dijo: 'evolucion' | 'distintas' | 'duplicado'
}

async function getModelState(key: string): Promise<string | null> {
  const db = getDb()
  const { data } = await db.from('model_state').select('value').eq('key', key).single()
  return data?.value ?? null
}

async function setModelState(key: string, value: string) {
  const db = getDb()
  await db.from('model_state').upsert({ key, value, updated_at: new Date().toISOString() })
}

export async function recordFeedback(entry: FeedbackEntry) {
  const db = getDb()
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
  await db.from('feedback').insert({
    id,
    tipo: entry.tipo,
    signal_id: entry.signal_id,
    query: entry.query || '',
    proyecto: entry.proyecto || '',
    tema: entry.tema || '',
    modelo: entry.modelo || '',
    score_coseno: entry.score_coseno || 0,
  })

  const { count } = await db.from('feedback').select('*', { count: 'exact', head: true })
  if (count && Number(count) % 10 === 0) {
    await learnModelRouting()
  }
}

export async function recordMergeFeedback(entry: MergeFeedbackEntry) {
  const db = getDb()
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
  await db.from('merge_feedback').insert({
    id,
    vector_a: entry.vector_a,
    vector_b: entry.vector_b,
    texto_a: entry.texto_a,
    texto_b: entry.texto_b,
    score_coseno: entry.score_coseno,
    proyecto: entry.proyecto || '',
    tema: entry.tema || '',
    usuario_dijo: entry.usuario_dijo,
  })
  await recalculateThresholds()
}

export async function getThresholds(): Promise<{ duplicado: number; evolucion: number }> {
  const raw = await getModelState('thresholds')
  if (raw) { try { return JSON.parse(raw) } catch {} }
  return { duplicado: 0.85, evolucion: 0.50 }
}

async function recalculateThresholds() {
  const db = getDb()
  const { data: rows } = await db
    .from('merge_feedback')
    .select('score_coseno, usuario_dijo')
    .order('created_at', { ascending: false })
    .limit(100)

  if (!rows || rows.length < 10) return

  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
  const avgDup = avg(rows.filter(r => r.usuario_dijo === 'duplicado').map(r => r.score_coseno))
  const avgEvo = avg(rows.filter(r => r.usuario_dijo === 'evolucion').map(r => r.score_coseno))
  const current = await getThresholds()

  await setModelState('thresholds', JSON.stringify({
    duplicado: avgDup ? Math.round(((avgDup + current.duplicado) / 2) * 100) / 100 : current.duplicado,
    evolucion: avgEvo ? Math.round(((avgEvo + current.evolucion) / 2) * 100) / 100 : current.evolucion,
  }))
}

async function learnModelRouting() {
  const db = getDb()
  const { data: rows } = await db
    .from('feedback')
    .select('signals(tema, modelo)')
    .eq('tipo', 'copy')

  if (!rows?.length) return

  const routing: Record<string, { modelo: string; uses: number }> = {}
  for (const row of rows) {
    const { tema, modelo } = (row as any).signals || {}
    if (!tema || !modelo) continue
    if (!routing[tema] || routing[tema].uses < 1) {
      routing[tema] = { modelo, uses: (routing[tema]?.uses || 0) + 1 }
    } else {
      routing[tema].uses++
    }
  }
  await setModelState('learned_routing', JSON.stringify(routing))
}

export async function getLearnedRouting(): Promise<Record<string, string>> {
  const raw = await getModelState('learned_routing')
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return Object.fromEntries(Object.entries(parsed).map(([t, d]) => [t, (d as any).modelo]))
  } catch { return {} }
}

export async function getLearningStats() {
  const db = getDb()
  const { count: feedbackCount } = await db.from('feedback').select('*', { count: 'exact', head: true })
  const { count: mergeCount }    = await db.from('merge_feedback').select('*', { count: 'exact', head: true })
  const { count: lexiconCount }  = await db.from('lexicon').select('*', { count: 'exact', head: true })
  const thresholds = await getThresholds()
  const routing    = await getLearnedRouting()
  return { feedbackCount, mergeCount, lexiconCount, thresholds, routing }
}