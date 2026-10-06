import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createAlexandriaServer, SERVER_VERSION } from './server.js'

async function main() {
  const server = createAlexandriaServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(`🏛️ Alexandria MCP server v${SERVER_VERSION} running`)
}

main().catch(console.error)
