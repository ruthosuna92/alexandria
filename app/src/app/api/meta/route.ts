// meta/route.ts
import { NextResponse } from 'next/server'
import { getDb, OVERVIEW_CONTEXTO } from '@/lib/db'

// Reads live data; without this Next.js prerenders it once at build time.
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const db = getDb()

    const { count: total }    = await db.from('signals').select('*', { count: 'exact', head: true }).neq('contexto', OVERVIEW_CONTEXTO)
    const { data: proyData }  = await db.from('signals').select('proyecto').neq('contexto', OVERVIEW_CONTEXTO)
    const { data: temaData }  = await db.from('signals').select('tema').neq('contexto', OVERVIEW_CONTEXTO)
    const { data: stackData } = await db.from('signals').select('stack').neq('contexto', OVERVIEW_CONTEXTO)

    const proyectos = [...new Set((proyData||[]).map(r => r.proyecto))].sort()
    const temas     = [...new Set((temaData||[]).map(r => r.tema))].sort()
    const stacks    = [...new Set((stackData||[]).flatMap(r => r.stack || []))].sort()

    return NextResponse.json({ total, projects: proyectos.length, topics: temas.length, proyectos, temas, stacks })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}