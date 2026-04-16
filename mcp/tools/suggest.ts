import { getDb, getModelState } from '../lib/db.js'

const ROUTING_TABLE: Record<string, { modelo: string; razon: string }> = {
  arquitectura: { modelo: 'claude-opus-4-6',   razon: 'decisiones críticas y diseño de sistemas' },
  bug:          { modelo: 'claude-sonnet-4-6', razon: 'debugging y análisis primer intento' },
  feature:      { modelo: 'claude-sonnet-4-6', razon: 'implementación de features nuevas' },
  planning:     { modelo: 'claude-sonnet-4-6', razon: 'planificación y estrategia' },
  ui:           { modelo: 'gemini-flash',       razon: 'UI repetitiva y boilerplate' },
  otro:         { modelo: 'claude-haiku-4-5',  razon: 'microtareas y clasificación' },
}

export const suggestTool = {
  name: 'alexandria_suggest_model',
  description: 'Sugiere qué modelo de IA y skill usar para una tarea específica, basándose en el routing aprendido del usuario.',
  inputSchema: {
    type: 'object',
    properties: {
      tema:  { type: 'string', description: 'Tipo de tarea: bug, feature, arquitectura, planning, ui, otro' },
      stack: { type: 'string', description: 'Tecnología principal (opcional)' },
    },
    required: ['tema']
  }
}

export async function handleSuggest(args: { tema: string; stack?: string }) {
  const db = await getDb()

  let learnedRouting: Record<string, string> = {}
  try {
    const raw = getModelState(db, 'learned_routing')
    if (raw) {
      const parsed = JSON.parse(raw)
      learnedRouting = Object.fromEntries(Object.entries(parsed).map(([t, d]) => [t, (d as any).modelo]))
    }
  } catch {}

  const learnedModel = learnedRouting[args.tema]
  const defaultRoute = ROUTING_TABLE[args.tema] || ROUTING_TABLE['otro']

  const modelo = learnedModel || defaultRoute.modelo
  const source = learnedModel ? '📊 aprendido de tu historial' : '📋 tabla base'

  const skillMap: Record<string, string> = {
    'Next.js': 'nextjs.md', 'TypeScript': 'nextjs.md',
    'Supabase': 'supabase.md', 'Clerk': 'clerk.md',
    'Plasmo': 'plasmo.md', 'Expo': 'expo.md',
  }
  const skill = args.stack ? (skillMap[args.stack] || 'nextjs.md') : 'nextjs.md'

  return {
    content: [{
      type: 'text' as const,
      text: `[Alexandria — sugerencia]\nModelo: ${modelo} (${source})\nSkill: ${skill}\nRazón: ${defaultRoute.razon}`
    }]
  }
}
