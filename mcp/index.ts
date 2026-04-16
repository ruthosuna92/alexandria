import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { handleQuery } from './tools/query.js'
import { handleSave } from './tools/save.js'
import { handleSuggest } from './tools/suggest.js'
import { handleRegenerate } from './tools/regenerate.js'

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
  },
  async (args) => handleSave(args)
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
