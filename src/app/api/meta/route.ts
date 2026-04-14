import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  try {
    const db = getDb()
    const total    = (db.prepare('SELECT COUNT(*) as c FROM signals').get() as any).c
    const projects = (db.prepare('SELECT COUNT(DISTINCT proyecto) as c FROM signals').get() as any).c
    const topics   = (db.prepare('SELECT COUNT(DISTINCT tema) as c FROM signals').get() as any).c

    const proyectos = db.prepare('SELECT DISTINCT proyecto FROM signals ORDER BY proyecto').all().map((r: any) => r.proyecto)
    const temas     = db.prepare('SELECT DISTINCT tema FROM signals ORDER BY tema').all().map((r: any) => r.tema)
    const stacks    = db.prepare('SELECT stack FROM signals').all()
      .flatMap((r: any) => { try { return JSON.parse(r.stack) } catch { return [] } })
      .filter((v, i, a) => v && a.indexOf(v) === i)
      .sort()

    return NextResponse.json({ total, projects, topics, proyectos, temas, stacks })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
