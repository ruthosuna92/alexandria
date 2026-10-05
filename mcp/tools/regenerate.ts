import { generateOverview } from '../lib/overview.js'
import { countProjectSignals, resolveProjectName } from '../lib/signals-repo.js'

export async function handleRegenerate(args: { proyecto: string }) {
  const proyecto = await resolveProjectName(args.proyecto)
  const count = await countProjectSignals(proyecto)

  if (count === 0) {
    return {
      content: [{
        type: 'text' as const,
        text: `[Alexandria] No hay signals guardados para ${proyecto} todavía.`
      }]
    }
  }

  await generateOverview(proyecto)

  return {
    content: [{
      type: 'text' as const,
      text: `[Alexandria] ✅ Overview de ${proyecto} regenerado con ${count} signals.\nYa disponible para futuras consultas.`
    }]
  }
}
