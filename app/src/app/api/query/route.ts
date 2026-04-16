import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { getMachineId } from '@/lib/machine-id'
import { getLexicon, expandWithLexicon } from '@/lib/lexicon'
import { vectorize, queryIndex } from '@/lib/vector'

export async function POST(req: NextRequest) {
  try {
    const { q, proyecto, tema, stack } = await req.json()
    const db = await getDb()
    const machineId = getMachineId()
    const lexicon = await getLexicon()

    let query = 'SELECT id,proyecto,contexto,tema,stack,modelo,skill,encrypted,fecha FROM signals WHERE 1=1'
    const params: string[] = []
    if (proyecto) { query += ` AND proyecto = '${proyecto}'` }
    if (tema)     { query += ` AND tema = '${tema}'` }
    if (stack)    { query += ` AND stack LIKE '%${stack}%'` }
    query += ' ORDER BY created_at DESC'

    const res = db.exec(query)
    const allRows = res.length ? res[0].values.map((row: any[]) => {
      const r: any = {}
      res[0].columns.forEach((c: string, i: number) => r[c] = row[i])
      return r
    }) : []

    let results = allRows

    if (q && q.trim()) {
      const expanded = expandWithLexicon(q, lexicon)
      const vector = await vectorize(expanded)
      const vectorResults = await queryIndex(vector, 20)
      const tokens = expanded.toLowerCase().split(/\W+/).filter((w: string) => w.length > 2)

      results = allRows.map((r: any) => {
        const vectorScore = vectorResults.find(v => v.id === r.id)?.score || 0
        const haystack = [r.proyecto, r.contexto, r.tema, r.stack].join(' ').toLowerCase()
        let decrypted = ''
        try { decrypted = decrypt(r.encrypted, machineId).toLowerCase() } catch {}
        const txtMatch = tokens.some((t: string) => (haystack + ' ' + decrypted).includes(t))
        const score = txtMatch ? Math.max(vectorScore, 0.3) : vectorScore
        return { ...r, score, txtMatch }
      })
      .filter((r: any) => r.score > 0.05 || r.txtMatch)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 6)
    }

    const signals = results.slice(0, 10).map((r: any) => {
      let parsed = {}
      try { parsed = JSON.parse(decrypt(r.encrypted, machineId)) } catch {}
      return { id: r.id, proyecto: r.proyecto, contexto: r.contexto, tema: r.tema, stack: JSON.parse(r.stack || '[]'), modelo: r.modelo, skill: r.skill, fecha: r.fecha, score: r.score, parsed }
    })

    return NextResponse.json({ signals })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
