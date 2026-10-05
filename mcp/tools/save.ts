import { expandWithLexicon } from '../lib/lexicon.js'
import { embed } from '../lib/embedding.js'
import { getLexicon, insertSignal, resolveProjectName } from '../lib/signals-repo.js'

export const saveTool = {
  name: 'alexandria_save',
  description: 'Guarda un signal de contexto en Alexandria. Usa el prompt compactador primero para generar el JSON.',
  inputSchema: {
    type: 'object',
    properties: {
      proyecto:          { type: 'string' },
      contexto:          { type: 'string' },
      tema:              { type: 'string' },
      stack:             { type: 'array', items: { type: 'string' } },
      decisiones:        { type: 'array', items: { type: 'string' } },
      preferencias:      { type: 'array', items: { type: 'string' } },
      errores_resueltos: { type: 'array', items: { type: 'string' } },
      modelo_sugerido:   { type: 'string' },
      skill_sugerida:    { type: 'string' },
    },
    required: ['proyecto', 'contexto', 'tema']
  }
}

interface SaveArgs {
  proyecto: string
  contexto: string
  tema: string
  stack?: string[]
  decisiones?: string[]
  preferencias?: string[]
  errores_resueltos?: string[]
  modelo_sugerido?: string
  skill_sugerida?: string
}

export async function handleSave(args: SaveArgs) {
  const proyecto = await resolveProjectName(args.proyecto)
  const lexicon  = await getLexicon()

  // Same embedding text as the app's POST /api/signals, so a signal is
  // embedded identically whether it was saved from the MCP or the app.
  const textForVector = expandWithLexicon(
    [
      proyecto, args.contexto, args.tema,
      ...(args.stack || []),
      ...(args.decisiones || []),
      ...(args.preferencias || []),
      ...(args.errores_resueltos || []),
      args.skill_sugerida || '',
    ].join(' '),
    lexicon
  )

  const embedding = await embed(textForVector)
  const id        = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  const fecha     = new Date().toLocaleDateString('es-CO')

  await insertSignal({
    id,
    proyecto,
    contexto:          args.contexto || '',
    tema:              args.tema || 'otro',
    stack:             args.stack || [],
    decisiones:        args.decisiones || [],
    preferencias:      args.preferencias || [],
    errores_resueltos: args.errores_resueltos || [],
    modelo:            args.modelo_sugerido || '',
    skill:             args.skill_sugerida || '',
    fecha,
    embedding,
  })

  // Automatic overview regeneration is re-enabled once overview generation
  // moves to Supabase (lib/overview.ts still targets the old local db).

  return {
    content: [{
      type: 'text' as const,
      text: `[Alexandria] ✅ Signal guardado\nProyecto: ${proyecto}\nContexto: ${args.contexto}\nFecha: ${fecha}`
    }]
  }
}
