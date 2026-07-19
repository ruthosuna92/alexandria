import { generateOverview } from '../lib/overview.js'
import { getDb } from '../lib/db.js'

export async function handleRegenerate(args: { proyecto: string }) {
  const db = await getDb()

  const countRes = db.exec(`SELECT COUNT(*) FROM signals WHERE proyecto = ? AND contexto != 'overview'`, [args.proyecto])
  const count = Number(countRes[0]?.values[0][0] || 0)

  if (count === 0) {
    return {
      content: [{
        type: 'text' as const,
        text: `[Alexandria] No hay signals guardados para ${args.proyecto} todavía.`
      }]
    }
  }

  await generateOverview(args.proyecto)

  return {
    content: [{
      type: 'text' as const,
      text: `[Alexandria] ✅ Overview de ${args.proyecto} regenerado con ${count} signals.\nYa disponible para futuras consultas.`
    }]
  }
}
