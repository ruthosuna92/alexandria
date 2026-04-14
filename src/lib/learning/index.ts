import { getDb, persist, getModelState, setModelState } from '@/lib/db'

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

export async function recordFeedback(entry: FeedbackEntry) {
  const db = await getDb()
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
  db.run(
    `INSERT INTO feedback (id, tipo, signal_id, query, proyecto, tema, modelo, score_coseno)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, entry.tipo, entry.signal_id, entry.query||'', entry.proyecto||'', entry.tema||'', entry.modelo||'', entry.score_coseno||0]
  )
  persist(db)
  const countRes = db.exec('SELECT COUNT(*) FROM feedback')
  const count = countRes[0]?.values[0][0] || 0
  if (Number(count) % 10 === 0) {
    await learnSynonyms(db)
    await learnModelRouting(db)
  }
}

export async function recordMergeFeedback(entry: MergeFeedbackEntry) {
  const db = await getDb()
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
  db.run(
    `INSERT INTO merge_feedback (id, vector_a, vector_b, texto_a, texto_b, score_coseno, proyecto, tema, usuario_dijo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, JSON.stringify(entry.vector_a), JSON.stringify(entry.vector_b),
     entry.texto_a, entry.texto_b, entry.score_coseno, entry.proyecto||'', entry.tema||'', entry.usuario_dijo]
  )
  persist(db)
  await recalculateThresholds(db)
}

export async function getThresholds(): Promise<{ duplicado: number; evolucion: number }> {
  const db = await getDb()
  const raw = getModelState(db, 'thresholds')
  if (raw) { try { return JSON.parse(raw) } catch {} }
  return { duplicado: 0.85, evolucion: 0.50 }
}

async function recalculateThresholds(db: any) {
  const res = db.exec('SELECT score_coseno, usuario_dijo FROM merge_feedback ORDER BY fecha DESC LIMIT 100')
  if (!res.length) return
  const rows = res[0].values as [number, string][]
  if (rows.length < 10) return

  const avg = (arr: number[]) => arr.length ? arr.reduce((a,b) => a+b, 0) / arr.length : null
  const avgDup = avg(rows.filter(r => r[1]==='duplicado').map(r => r[0]))
  const avgEvo = avg(rows.filter(r => r[1]==='evolucion').map(r => r[0]))
  const current = await getThresholds()

  const newThresholds = {
    duplicado: avgDup ? Math.round(((avgDup + current.duplicado) / 2) * 100) / 100 : current.duplicado,
    evolucion: avgEvo ? Math.round(((avgEvo + current.evolucion) / 2) * 100) / 100 : current.evolucion,
  }
  setModelState(db, 'thresholds', JSON.stringify(newThresholds))
  setModelState(db, 'feedback_count', rows.length.toString())
}

async function learnSynonyms(db: any) {
  const res = db.exec(`
    SELECT f.query, s.stack
    FROM feedback f
    JOIN signals s ON f.signal_id = s.id
    WHERE f.tipo = 'copy' AND f.query != ''
    ORDER BY f.fecha DESC LIMIT 200
  `)
  if (!res.length) return

  const pairs: Map<string, Set<string>> = new Map()
  for (const row of res[0].values as string[][]) {
    const queryTokens = row[0].toLowerCase().split(/\W+/).filter(w => w.length > 3)
    let stackTerms: string[] = []
    try { stackTerms = JSON.parse(row[1]||'[]').map((s: string) => s.toLowerCase()) } catch {}
    for (const qt of queryTokens) {
      for (const st of stackTerms) {
        if (qt !== st && !qt.includes(st) && !st.includes(qt)) {
          const key = [qt, st].sort().join('|||')
          if (!pairs.has(key)) pairs.set(key, new Set([qt, st]))
        }
      }
    }
  }

  for (const [, terms] of pairs.entries()) {
    const termsArr = [...terms]
    const termsJson = JSON.stringify(termsArr).replace(/'/g, "''")
    const existing = db.exec(`SELECT id, confidence FROM learned_synonyms WHERE terms = '${termsJson}'`)
    if (existing.length && existing[0].values.length) {
      db.run(`UPDATE learned_synonyms SET confidence = MIN(confidence + 0.1, 1.0) WHERE terms = '${termsJson}'`)
    } else {
      const id = 'lsyn_' + Date.now().toString(36) + Math.random().toString(36).slice(2,4)
      db.run(`INSERT OR IGNORE INTO learned_synonyms (id, terms, confidence, source) VALUES ('${id}', '${termsJson}', 0.1, 'behavior')`)
    }
  }

  const highConf = db.exec(`SELECT id, terms FROM learned_synonyms WHERE confidence >= 0.5 AND source = 'behavior'`)
  if (highConf.length) {
    for (const row of highConf[0].values as string[][]) {
      const terms = JSON.parse(row[1])
      const termsJson = JSON.stringify(terms).replace(/'/g, "''")
      const exists = db.exec(`SELECT id FROM lexicon WHERE terms = '${termsJson}'`)
      if (!exists.length || !exists[0].values.length) {
        const id = 'lex_auto_' + Date.now().toString(36)
        db.run(`INSERT OR IGNORE INTO lexicon (id, terms, domain, langs, source) VALUES ('${id}', '${termsJson}', 'learned', '[]', 'behavior')`)
      }
    }
  }
  persist(db)
}

async function learnModelRouting(db: any) {
  const res = db.exec(`
    SELECT s.tema, s.modelo, COUNT(*) as uses
    FROM feedback f JOIN signals s ON f.signal_id = s.id
    WHERE f.tipo = 'copy' AND s.modelo != ''
    GROUP BY s.tema, s.modelo ORDER BY uses DESC
  `)
  if (!res.length) return
  const routing: Record<string, { modelo: string; uses: number }> = {}
  for (const row of res[0].values as any[][]) {
    const [tema, modelo, uses] = row
    if (!routing[tema] || uses > routing[tema].uses) routing[tema] = { modelo, uses }
  }
  setModelState(db, 'learned_routing', JSON.stringify(routing))
}

export async function getLearnedRouting(): Promise<Record<string, string>> {
  const db = await getDb()
  const raw = getModelState(db, 'learned_routing')
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return Object.fromEntries(Object.entries(parsed).map(([t, d]) => [t, (d as any).modelo]))
  } catch { return {} }
}

export async function getLearningStats() {
  const db = await getDb()
  const feedbackCount = db.exec('SELECT COUNT(*) FROM feedback')[0]?.values[0][0] || 0
  const mergeCount    = db.exec('SELECT COUNT(*) FROM merge_feedback')[0]?.values[0][0] || 0
  const synonymsCount = db.exec("SELECT COUNT(*) FROM learned_synonyms WHERE confidence >= 0.5")[0]?.values[0][0] || 0
  const thresholds    = await getThresholds()
  const routing       = await getLearnedRouting()
  return { feedbackCount, mergeCount, synonymsCount, thresholds, routing }
}
