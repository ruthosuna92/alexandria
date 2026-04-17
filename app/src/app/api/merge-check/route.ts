import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { vectorize } from '@/lib/vector'
import { getThresholds } from '@/lib/learning'

function cosineSim(a: number[], b: number[]): number {
  let dot = 0, ma = 0, mb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; ma += a[i]*a[i]; mb += b[i]*b[i] }
  return dot / (Math.sqrt(ma) * Math.sqrt(mb) || 1)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { proyecto, contexto } = body
    if (!proyecto) return NextResponse.json({ exists: false })

    const db = getDb()
    let query = db
      .from('signals')
      .select('id,proyecto,contexto,tema,stack,decisiones,embedding')
      .eq('proyecto', proyecto)
      .order('created_at', { ascending: false })
      .limit(5)

    if (contexto) query = query.eq('contexto', contexto)

    const { data, error } = await query
    if (error || !data?.length) return NextResponse.json({ exists: false })

    const thresholds = await getThresholds()
    const newText = [proyecto, contexto, ...(body.decisiones||[]), ...(body.stack||[])].join(' ')
    const newVector = await vectorize(newText)

    const candidates = []
    for (const r of data) {
      const oldText = [r.proyecto, r.contexto, ...(r.decisiones||[]), ...(r.stack||[])].join(' ')
      const oldVector = r.embedding as number[]
      const score = cosineSim(newVector, oldVector)

      const decisionsAnalysis = []
      for (const newDec of (body.decisiones||[])) {
        const newDecVec = await vectorize(newDec)
        for (const oldDec of (r.decisiones||[])) {
          const oldDecVec = await vectorize(oldDec)
          const decScore = cosineSim(newDecVec, oldDecVec)
          if (decScore > thresholds.evolucion) {
            decisionsAnalysis.push({
              nueva: newDec, anterior: oldDec, score: decScore,
              tipo: decScore > thresholds.duplicado ? 'duplicado' : 'evolucion'
            })
          }
        }
      }

      candidates.push({ id: r.id, proyecto: r.proyecto, contexto: r.contexto, score, decisionsAnalysis })
    }

    const best = candidates.sort((a, b) => b.score - a.score)[0]
    if (best.score < 0.3) return NextResponse.json({ exists: false })

    return NextResponse.json({ exists: true, match: best, thresholds })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}