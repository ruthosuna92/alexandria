import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { getMachineId } from '@/lib/machine-id'
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

    const db = await getDb()
    let query = `SELECT id, proyecto, contexto, encrypted FROM signals WHERE proyecto = '${proyecto.replace(/'/g,"''")}' ORDER BY created_at DESC LIMIT 5`
    if (contexto) {
      query = `SELECT id, proyecto, contexto, encrypted FROM signals WHERE proyecto = '${proyecto.replace(/'/g,"''")}' AND contexto = '${contexto.replace(/'/g,"''")}' ORDER BY created_at DESC LIMIT 3`
    }

    const res = db.exec(query)
    if (!res.length || !res[0].values.length) return NextResponse.json({ exists: false })

    const machineId = getMachineId()
    const thresholds = await getThresholds()

    const newText = [proyecto, contexto, ...(body.decisiones||[]), ...(body.stack||[])].join(' ')
    const newVector = await vectorize(newText)

    const candidates = []
    for (const row of res[0].values as any[][]) {
      const [id, proj, ctx, encrypted] = row
      let parsed: any = {}
      try { parsed = JSON.parse(decrypt(encrypted, machineId)) } catch {}

      const oldText = [proj, ctx, ...(parsed.decisiones||[]), ...(parsed.stack||[])].join(' ')
      const oldVector = await vectorize(oldText)
      const score = cosineSim(newVector, oldVector)

      const decisionsAnalysis = []
      for (const newDec of (body.decisiones||[])) {
        const newDecVec = await vectorize(newDec)
        for (const oldDec of (parsed.decisiones||[])) {
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

      candidates.push({ id, proyecto: proj, contexto: ctx, score, decisionsAnalysis, parsed })
    }

    const best = candidates.sort((a,b) => b.score - a.score)[0]
    if (best.score < 0.3) return NextResponse.json({ exists: false })

    return NextResponse.json({
      exists: true,
      match: best,
      thresholds
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
