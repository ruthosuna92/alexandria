import { getDb, withFreshDb } from './db.js'
import { getLexicon, expandWithLexicon } from './lexicon.js'
import { vectorize, addToIndex } from './vector.js'

export async function maybeGenerateOverview(proyecto: string) {
  const db = await getDb()

  const countRes = db.exec(`
    SELECT COUNT(*) FROM signals
    WHERE proyecto = ?
    AND (contexto != 'overview' OR contexto IS NULL)
  `, [proyecto])
  const count = Number(countRes[0]?.values[0][0] || 0)

  if (count < 3 || count % 3 !== 0) return

  await generateOverview(proyecto)
}

export async function generateOverview(proyecto: string) {
  const db = await getDb()

  const res = db.exec(`
    SELECT encrypted FROM signals
    WHERE proyecto = ?
    AND contexto != 'overview'
    ORDER BY created_at DESC
    LIMIT 30
  `, [proyecto])

  if (!res.length || !res[0].values.length) return

  const allDecisiones  = new Set<string>()
  const allPreferencias = new Set<string>()
  const allStack       = new Set<string>()
  const allErrores     = new Set<string>()
  const allTemas       = new Set<string>()
  const allModelos     = new Map<string, number>()
  const allSkills      = new Map<string, number>()

  for (const row of res[0].values as any[][]) {
    let parsed: any = {}
    try { parsed = JSON.parse(row[0]) } catch { continue }

    if (parsed.tema)              allTemas.add(parsed.tema)
    if (parsed.modelo_sugerido)   allModelos.set(parsed.modelo_sugerido, (allModelos.get(parsed.modelo_sugerido)||0) + 1)
    if (parsed.skill_sugerida)    allSkills.set(parsed.skill_sugerida,   (allSkills.get(parsed.skill_sugerida)||0) + 1)
    ;(parsed.stack             ||[]).forEach((s: string) => allStack.add(s))
    ;(parsed.decisiones        ||[]).forEach((d: string) => allDecisiones.add(d))
    ;(parsed.preferencias      ||[]).forEach((p: string) => allPreferencias.add(p))
    ;(parsed.errores_resueltos ||[]).forEach((e: string) => allErrores.add(e))
  }

  const topModelo = [...allModelos.entries()].sort((a,b) => b[1]-a[1])[0]?.[0] || 'claude-sonnet-4-6'
  const topSkill  = [...allSkills.entries()].sort((a,b) => b[1]-a[1])[0]?.[0] || 'nextjs.md'

  const overviewSignal = {
    proyecto,
    contexto: 'overview',
    tema: 'arquitectura',
    tipo: 'overview',
    stack:             [...allStack],
    decisiones:        [...allDecisiones],
    preferencias:      [...allPreferencias],
    errores_resueltos: [...allErrores],
    modelo_sugerido:   topModelo,
    skill_sugerida:    topSkill,
    temas_cubiertos:   [...allTemas],
    total_signals:     res[0].values.length,
    auto_generated:    true,
  }

  const lexicon = await getLexicon()
  const textForVector = expandWithLexicon(
    [
      proyecto, proyecto, proyecto,
      'overview', 'overview', 'overview',
      ...[...allStack],
      ...[...allDecisiones].slice(0, 10),
      ...[...allPreferencias],
    ].join(' '),
    lexicon
  )
  const vector = await vectorize(textForVector)

  const encrypted = JSON.stringify(overviewSignal)
  const stackJson = JSON.stringify([...allStack])

  // The existence check runs inside the lock so a concurrent regeneration from
  // the other MCP process can't race us into inserting a duplicate overview row.
  const overviewId = await withFreshDb(freshDb => {
    const existing = freshDb.exec(`
      SELECT id FROM signals
      WHERE proyecto = ?
      AND contexto = 'overview'
    `, [proyecto])

    if (existing.length && existing[0].values.length) {
      const existingId = existing[0].values[0][0] as string
      freshDb.run(
        `UPDATE signals SET encrypted = ?, stack = ?, modelo = ?, skill = ?, created_at = strftime('%s','now') WHERE id = ?`,
        [encrypted, stackJson, topModelo, topSkill, existingId]
      )
      return existingId
    }

    const id = 'ov_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
    const fecha = new Date().toLocaleDateString('es-CO')
    freshDb.run(
      `INSERT INTO signals (id,proyecto,contexto,tema,stack,modelo,skill,encrypted,vector_id,fecha)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [id, proyecto, 'overview', 'arquitectura', stackJson, topModelo, topSkill, encrypted, id, fecha]
    )
    return id
  })

  await addToIndex(overviewId, vector, { proyecto, contexto: 'overview', tipo: 'overview' })
}
