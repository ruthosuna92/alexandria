// prompt/route.ts
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getLearnedRouting } from '@/lib/learning'

export async function GET() {
  try {
    const db = getDb()
    const { data: proyData }  = await db.from('signals').select('proyecto')
    const { data: temaData }  = await db.from('signals').select('tema')
    const { data: skillData } = await db.from('signals').select('skill').neq('skill', '')
    const { data: modelData } = await db.from('signals').select('modelo').neq('modelo', '')

    const proyectos = [...new Set((proyData||[]).map(r => r.proyecto))].filter(Boolean).sort()
    const temas     = [...new Set((temaData||[]).map(r => r.tema))].filter(Boolean).sort()
    const skills    = [...new Set((skillData||[]).map(r => r.skill))].filter(Boolean).sort()
    const modelos   = [...new Set((modelData||[]).map(r => r.modelo))].filter(Boolean).sort()

    const BASE_TEMAS   = ['bug', 'feature', 'arquitectura', 'planning', 'ui', 'otro']
    const BASE_SKILLS  = ['nextjs.md', 'plasmo.md', 'supabase.md', 'clerk.md', 'expo.md']
    const BASE_MODELOS = ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5', 'gemini-flash']

    const allTemas   = [...new Set([...BASE_TEMAS,   ...temas])]
    const allSkills  = [...new Set([...BASE_SKILLS,  ...skills])]
    const allModelos = [...new Set([...BASE_MODELOS, ...modelos])]

    const learnedRouting = await getLearnedRouting()
    const routingHint = Object.keys(learnedRouting).length
      ? `\n// Sugerencia aprendida por tema: ${JSON.stringify(learnedRouting)}`
      : ''

    const prompt = `Dame un resumen de esta conversación en formato JSON:
{
  "proyecto": "${proyectos.length ? proyectos.join(' | ') : 'nombre corto del proyecto'}",
  "contexto": "tarea específica (ej: refactor breadcrumbs, fix race condition viewer)",
  "tema": "${allTemas.join(' | ')}",
  "stack": ["tecnologías", "usadas"],
  "decisiones": ["decisiones importantes tomadas"],
  "preferencias": ["preferencias expresadas"],
  "errores_resueltos": ["bugs resueltos"],
  "modelo_sugerido": "${allModelos.join(' | ')}",${routingHint}
  "skill_sugerida": "${allSkills.join(' | ')}"
}
Solo el JSON, sin texto adicional ni backticks.`

    return NextResponse.json({ prompt, meta: { proyectos, temas: allTemas, skills: allSkills, modelos: allModelos } })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}