import { runArbiter } from '../lib/arbiter.js'

export const queryTool = {
  name: 'alexandria_query',
  description: 'Busca contexto relevante en Alexandria. Usa esto ANTES de responder cualquier pregunta técnica del usuario para inyectar su historial de decisiones, stack y preferencias. Soporta queries compuestas con "y" / "and" para buscar dos temas a la vez.',
  inputSchema: {
    type: 'object',
    properties: {
      q:        { type: 'string',  description: 'Query de búsqueda. Puede ser compuesta: "race condition y viewer initialization"' },
      proyecto: { type: 'string',  description: 'Filtrar por proyecto específico (ej: Spybee, Alexandria)' },
      tema:     { type: 'string',  description: 'Filtrar por tema: bug, feature, arquitectura, planning, ui, otro' },
      stack:    { type: 'string',  description: 'Filtrar por tecnología (ej: Next.js, TypeScript)' },
    },
    required: ['q']
  }
}

export async function handleQuery(args: { q: string; proyecto?: string; tema?: string; stack?: string }) {
  const result = await runArbiter(args.q, args.proyecto, args.tema, args.stack)

  if (result.mode === 'none') {
    return {
      content: [{
        type: 'text' as const,
        text: `[Alexandria] No encontré contexto relevante para: "${args.q}"\n\nRazón: ${result.reason}\n\nProcede sin contexto previo.`
      }]
    }
  }

  const modeLabel = result.mode === 'combined' ? '🔗 combinado' : '📌 directo'

  return {
    content: [{
      type: 'text' as const,
      text: `[Alexandria — ${modeLabel}]\nRazón: ${result.reason}\n\n${result.context}`
    }]
  }
}
