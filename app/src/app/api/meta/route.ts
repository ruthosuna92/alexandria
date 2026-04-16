import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  try {
    const db = await getDb()

    const total    = db.exec('SELECT COUNT(*) as c FROM signals')[0]?.values[0][0] || 0
    const projects = db.exec('SELECT COUNT(DISTINCT proyecto) as c FROM signals')[0]?.values[0][0] || 0
    const topics   = db.exec('SELECT COUNT(DISTINCT tema) as c FROM signals')[0]?.values[0][0] || 0

    const proyectos = (db.exec('SELECT DISTINCT proyecto FROM signals ORDER BY proyecto')[0]?.values || []).map((r: any[]) => r[0])
    const temas     = (db.exec('SELECT DISTINCT tema FROM signals ORDER BY tema')[0]?.values || []).map((r: any[]) => r[0])
    const stackRows = (db.exec('SELECT stack FROM signals')[0]?.values || [])
    const stacks    = [...new Set(stackRows.flatMap((r: any[]) => { try { return JSON.parse(r[0]) } catch { return [] } }))].sort()

    return NextResponse.json({ total, projects, topics, proyectos, temas, stacks })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
