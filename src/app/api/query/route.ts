import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { getMachineId } from '@/lib/machine-id'
import { getLexicon, expandWithLexicon } from '@/lib/lexicon'
import { vectorize, queryIndex } from '@/lib/vector'

export async function POST(req: NextRequest) {
  try {
    const { q, proyecto, tema, stack } = await req.json()
    const db = getDb()
    const machineId = getMachineId()
    const lexicon = getLexicon()

    let rows: any[] = []

    if (q && q.trim()) {
      const expanded = expandWithLexicon(q, lexicon)
      const vector = await vectorize(expanded)
      const vectorResults = await queryIndex(vector, 20)
      const vectorIds = vectorResults.map(r => r.id)

      let dbQuery = 'SELECT * FROM signals WHERE 1=1'
      const params: string[] = []
      if (proyecto) { dbQuery += ' AND proyecto = ?'; params.push(proyecto) }
      if (tema)     { dbQuery += ' AND tema = ?';     params.push(tema) }
      if (stack)    { dbQuery += ' AND stack LIKE ?';  params.push(`%${stack}%`) }

      const allRows = db.prepare(dbQuery).all(...params) as any[]

      const expandedLower = expanded.toLowerCase()
      const tokens = expandedLower.split(/\W+/).filter(w => w.length > 2)

      rows = allRows
        .map(r => {
          const vectorScore = vectorResults.find(v => v.id === r.id)?.score || 0
          const haystack = [r.proyecto, r.contexto, r.tema, r.stack].join(' ').toLowerCase()
          let decrypted = ''
          try { decrypted = decrypt(r.encrypted, machineId).toLowerCase() } catch {}
          const full = haystack + ' ' + decrypted
          const txtMatch = tokens.some(t => full.includes(t))
          const score = txtMatch ? Math.max(vectorScore, 0.3) : vectorScore
          return { ...r, score, txtMatch }
        })
        .filter(r => r.score > 0.05 || r.txtMatch)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6)
    } else {
      let dbQuery = 'SELECT * FROM signals WHERE 1=1'
      const params: string[] = []
      if (proyecto) { dbQuery += ' AND proyecto = ?'; params.push(proyecto) }
      if (tema)     { dbQuery += ' AND tema = ?';     params.push(tema) }
      if (stack)    { dbQuery += ' AND stack LIKE ?';  params.push(`%${stack}%`) }
      dbQuery += ' ORDER BY created_at DESC LIMIT 10'
      rows = db.prepare(dbQuery).all(...params) as any[]
    }

    const signals = rows.map(r => {
      let parsed = {}
      try { parsed = JSON.parse(decrypt(r.encrypted, machineId)) } catch {}
      return {
        id: r.id,
        proyecto: r.proyecto,
        contexto: r.contexto,
        tema: r.tema,
        stack: JSON.parse(r.stack || '[]'),
        modelo: r.modelo,
        skill: r.skill,
        fecha: r.fecha,
        score: r.score,
        parsed
      }
    })

    return NextResponse.json({ signals })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
