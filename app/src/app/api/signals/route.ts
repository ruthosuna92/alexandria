import { NextRequest, NextResponse } from 'next/server'
import { getDb, persist } from '@/lib/db'
import { encrypt, decrypt } from '@/lib/crypto'
import { getMachineId } from '@/lib/machine-id'
import { getLexicon, expandWithLexicon } from '@/lib/lexicon'
import { vectorize, addToIndex, deleteFromIndex } from '@/lib/vector'

export async function GET(req: NextRequest) {
  try {
    const db = await getDb()
    const { searchParams } = new URL(req.url)
    const proyecto = searchParams.get('proyecto')
    const tema = searchParams.get('tema')
    const stack = searchParams.get('stack')

    let query = 'SELECT id,proyecto,contexto,tema,stack,modelo,skill,encrypted,fecha FROM signals WHERE 1=1'
    const params: any[] = []
    if (proyecto) { query += ' AND proyecto = ?'; params.push(proyecto) }
    if (tema)     { query += ' AND tema = ?';     params.push(tema) }
    if (stack)    { query += ' AND stack LIKE ?';  params.push(`%${stack}%`) }
    query += ' ORDER BY created_at DESC'

    const res = db.exec(query.replace(/\?/g, () => `'${params.shift()}'`))
    const rows = res.length ? res[0].values : []
    const cols = res.length ? res[0].columns : []
    const machineId = getMachineId()

    const signals = rows.map((row: any[]) => {
      const r: any = {}
      cols.forEach((c: string, i: number) => r[c] = row[i])
      let parsed = {}
      try { parsed = JSON.parse(decrypt(r.encrypted, machineId)) } catch {}
      return { id: r.id, proyecto: r.proyecto, contexto: r.contexto, tema: r.tema, stack: JSON.parse(r.stack || '[]'), modelo: r.modelo, skill: r.skill, fecha: r.fecha, parsed }
    })

    return NextResponse.json({ signals })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { proyecto, contexto, tema, stack, decisiones, preferencias, errores_resueltos, modelo_sugerido, skill_sugerida } = body
    if (!proyecto) return NextResponse.json({ error: 'proyecto is required' }, { status: 400 })

    const machineId = getMachineId()
    const lexicon = await getLexicon()
    const textForVector = expandWithLexicon(
      [proyecto, contexto, tema, ...(stack||[]), ...(decisiones||[]), ...(preferencias||[]), ...(errores_resueltos||[]), skill_sugerida||''].join(' '),
      lexicon
    )

    const vector = await vectorize(textForVector)
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    const encrypted = encrypt(JSON.stringify(body), machineId)
    const fecha = new Date().toLocaleDateString('es-CO')
    const db = await getDb()

    db.run(
      `INSERT INTO signals (id,proyecto,contexto,tema,stack,modelo,skill,encrypted,vector_id,fecha) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [id, proyecto, contexto||'', tema||'otro', JSON.stringify(stack||[]), modelo_sugerido||'', skill_sugerida||'', encrypted, id, fecha]
    )
    persist(db)
    await addToIndex(id, vector, { proyecto, contexto, tema })

    return NextResponse.json({ id, fecha })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    const db = await getDb()
    db.run('DELETE FROM signals WHERE id = ?', [id])
    persist(db)
    await deleteFromIndex(id)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
