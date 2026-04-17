import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getLexicon, expandWithLexicon } from '@/lib/lexicon'
import { vectorize, queryIndex } from '@/lib/vector'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.ALEXANDRIA_API_KEY}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { q, proyecto, tema, stack } = await req.json()
    const db = getDb()
    const lexicon = await getLexicon()

    let query = db.from('signals').select('id,proyecto,contexto,tema,stack,modelo,skill,fecha,decisiones,preferencias,errores_resueltos')
    if (proyecto) query = query.eq('proyecto', proyecto)
    if (tema)     query = query.eq('tema', tema)
    if (stack)    query = query.contains('stack', [stack])

    const { data: allRows, error } = await query.order('created_at', { ascending: false })
    if (error) throw new Error(error.message)

    let results = allRows || []

    if (q?.trim()) {
      const expanded = expandWithLexicon(q, lexicon)
      const vector = await vectorize(expanded)
      const vectorResults = await queryIndex(db, vector, 20, { proyecto, tema, stack })
      const tokens = expanded.toLowerCase().split(/\W+/).filter((w: string) => w.length > 2)

      results = results
        .map((r: any) => {
          const vectorScore = vectorResults.find((v: any) => v.id === r.id)?.score || 0
          const haystack = [r.proyecto, r.contexto, r.tema, JSON.stringify(r.stack)].join(' ').toLowerCase()
          const txtMatch = tokens.some((t: string) => haystack.includes(t))
          const score = txtMatch ? Math.max(vectorScore, 0.3) : vectorScore
          return { ...r, score, txtMatch }
        })
        .filter((r: any) => r.score > 0.05 || r.txtMatch)
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 6)
    }

    const signals = results.slice(0, 10).map((r: any) => ({
      id: r.id,
      proyecto: r.proyecto,
      contexto: r.contexto,
      tema: r.tema,
      stack: r.stack || [],
      modelo: r.modelo,
      skill: r.skill,
      fecha: r.fecha,
      decisiones: r.decisiones || [],
      preferencias: r.preferencias || [],
      errores_resueltos: r.errores_resueltos || [],
      score: r.score,
    }))

    return NextResponse.json({ signals })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}