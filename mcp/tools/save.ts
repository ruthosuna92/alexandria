import { getDb, persist } from '../lib/db.js'
import { encrypt } from '../lib/crypto.js'
import { getMachineId } from '../lib/machine-id.js'
import { getLexicon, expandWithLexicon } from '../lib/lexicon.js'
import { vectorize, addToIndex } from '../lib/vector.js'
import { maybeGenerateOverview } from '../lib/overview.js'

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

export async function handleSave(args: any) {
  const machineId = getMachineId()
  const lexicon   = await getLexicon()

  const textForVector = expandWithLexicon(
    [
      args.proyecto, args.proyecto, args.proyecto,
      args.contexto, args.contexto, args.contexto,
      args.tema, args.tema,
      ...(args.stack||[]), ...(args.stack||[]),
      ...(args.decisiones||[]),
      ...(args.preferencias||[]),
      ...(args.errores_resueltos||[]),
      args.skill_sugerida||''
    ].join(' '),
    lexicon
  )

  const vector    = await vectorize(textForVector)
  const id        = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  const encrypted = encrypt(JSON.stringify(args), machineId)
  const fecha     = new Date().toLocaleDateString('es-CO')
  const db        = await getDb()

  db.run(
    `INSERT INTO signals (id,proyecto,contexto,tema,stack,modelo,skill,encrypted,vector_id,fecha)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [id, args.proyecto, args.contexto||'', args.tema||'otro',
     JSON.stringify(args.stack||[]), args.modelo_sugerido||'',
     args.skill_sugerida||'', encrypted, id, fecha]
  )
  persist(db)
  await addToIndex(id, vector, { proyecto: args.proyecto, contexto: args.contexto, tema: args.tema })

  await maybeGenerateOverview(args.proyecto)

  const db2 = await getDb()
  const countRes = db2.exec(`SELECT COUNT(*) FROM signals WHERE proyecto = '${args.proyecto.replace(/'/g,"''")}' AND contexto != 'overview'`)
  const total = Number(countRes[0]?.values[0][0] || 0)
  const overviewMsg = total % 3 === 0 ? `\n🔄 Overview de ${args.proyecto} actualizado automáticamente` : ''

  return {
    content: [{
      type: 'text' as const,
      text: `[Alexandria] ✅ Signal guardado\nProyecto: ${args.proyecto}\nContexto: ${args.contexto}\nFecha: ${fecha}${overviewMsg}`
    }]
  }
}
