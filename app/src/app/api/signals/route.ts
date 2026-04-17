import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getLexicon, expandWithLexicon } from '@/lib/lexicon'
import { vectorize } from '@/lib/vector'

export async function GET(req: NextRequest) {
  try {
    const db = getDb()
    const { searchParams } = new URL(req.url)
    const proyecto = searchParams.get('proyecto')
    const tema     = searchParams.get('tema')
    const stack    = searchParams.get('stack')

    let query = db.from('signals').select('id,proyecto,contexto,tema,stack,modelo,skill,fecha')
    if (proyecto) query = query.eq('proyecto', proyecto)
    if (tema)     query = query.eq('tema', tema)
    if (stack)    query = query.contains('stack', [stack])

    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throw new Error(error.message)

    return NextResponse.json({ signals: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { proyecto, contexto, tema, stack, decisiones, preferencias, errores_resueltos, modelo_sugerido, skill_sugerida } = body
    if (!proyecto) return NextResponse.json({ error: 'proyecto is required' }, { status: 400 })

    const lexicon = await getLexicon()
    const textForVector = expandWithLexicon(
      [proyecto, contexto, tema, ...(stack||[]), ...(decisiones||[]), ...(preferencias||[]), ...(errores_resueltos||[]), skill_sugerida||''].join(' '),
      lexicon
    )
    const embedding = await vectorize(textForVector)
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    const fecha = new Date().toLocaleDateString('es-CO')
    const db = getDb()

    const { error } = await db.from('signals').insert({
      id, proyecto, contexto: contexto || '', tema: tema || 'otro',
      stack: stack || [], decisiones: decisiones || [],
      preferencias: preferencias || [], errores_resueltos: errores_resueltos || [],
      modelo: modelo_sugerido || '', skill: skill_sugerida || '',
      embedding, fecha
    })
    if (error) throw new Error(error.message)

    return NextResponse.json({ id, fecha })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    const db = getDb()
    const { error } = await db.from('signals').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}