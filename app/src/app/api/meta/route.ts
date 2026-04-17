// meta/route.ts
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  try {
    const db = getDb()

    const { count: total }    = await db.from('signals').select('*', { count: 'exact', head: true })
    const { data: proyData }  = await db.from('signals').select('proyecto')
    const { data: temaData }  = await db.from('signals').select('tema')
    const { data: stackData } = await db.from('signals').select('stack')

    const proyectos = [...new Set((proyData||[]).map(r => r.proyecto))].sort()
    const temas     = [...new Set((temaData||[]).map(r => r.tema))].sort()
    const stacks    = [...new Set((stackData||[]).flatMap(r => r.stack || []))].sort()

    return NextResponse.json({ total, projects: proyectos.length, topics: temas.length, proyectos, temas, stacks })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}