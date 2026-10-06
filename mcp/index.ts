import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { handleQuery } from './tools/query.js'
import { handleSave } from './tools/save.js'
import { handleSuggest } from './tools/suggest.js'
import { handleRegenerate } from './tools/regenerate.js'
import { handleLexiconList, handleLexiconSave } from './tools/lexicon.js'

const lexiconGroups = z.array(z.object({
  terms:  z.array(z.string()).describe('Términos de la misma familia: sinónimos, traducciones, alias'),
  domain: z.string().optional().describe('general | dev | project | mental-health | spybee | custom'),
  langs:  z.array(z.string()).optional().describe('Idiomas, ej: ["es", "en"]'),
}))

const server = new McpServer({
  name: 'alexandria',
  version: '0.2.0',
})

server.tool(
  'alexandria_query',
  {
    q:        z.string().describe('Query de búsqueda. Puede ser compuesta: "race condition y viewer initialization"'),
    proyecto: z.string().optional().describe('Filtrar por proyecto'),
    tema:     z.string().optional().describe('bug | feature | arquitectura | planning | ui | otro'),
    stack:    z.string().optional().describe('Filtrar por tecnología'),
  },
  async (args) => handleQuery(args)
)

server.tool(
  'alexandria_save',
  {
    proyecto:          z.string().describe('Nombre corto del proyecto'),
    contexto:          z.string().describe('Tarea específica'),
    tema:              z.string().describe('bug | feature | arquitectura | planning | ui | otro'),
    stack:             z.array(z.string()).optional().describe('Tecnologías usadas'),
    decisiones:        z.array(z.string()).optional().describe('Decisiones importantes'),
    preferencias:      z.array(z.string()).optional().describe('Preferencias expresadas'),
    errores_resueltos: z.array(z.string()).optional().describe('Bugs resueltos'),
    modelo_sugerido:   z.string().optional().describe('Modelo recomendado'),
    skill_sugerida:    z.string().optional().describe('Skill file recomendado'),
    lexicon:           lexiconGroups.optional().describe('Familias de palabras nuevas o ampliadas. Llama alexandria_lexicon_list antes para ver las reglas y el lexicon actual'),
  },
  async (args) => handleSave(args)
)

server.tool(
  'alexandria_lexicon_list',
  'Lista el lexicon de Alexandria (familias de sinónimos, traducciones y alias) y las reglas para proponer grupos nuevos.',
  {},
  async () => handleLexiconList()
)

server.tool(
  'alexandria_lexicon_save',
  'Guarda familias de palabras en el lexicon. Si un término ya existe en un grupo, los demás se agregan a ese grupo; si no, se crea uno nuevo.',
  {
    groups: lexiconGroups.describe('Máximo 3 grupos, 2+ términos de 4+ caracteres cada uno'),
  },
  async (args) => handleLexiconSave(args)
)

server.tool(
  'alexandria_suggest_model',
  {
    tema:  z.string().describe('Tipo de tarea'),
    stack: z.string().optional().describe('Tecnología principal'),
  },
  async (args) => handleSuggest(args)
)

server.tool(
  'alexandria_regenerate_overview',
  {
    proyecto: z.string().describe('Proyecto para regenerar el overview'),
  },
  async (args) => handleRegenerate(args)
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('🏛️ Alexandria MCP server v0.2.0 running')
}

main().catch(console.error)
