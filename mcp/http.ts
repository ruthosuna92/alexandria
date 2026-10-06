import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { createAlexandriaServer } from './server.js'

/**
 * Handles one MCP Streamable HTTP request (POST) and returns its response.
 *
 * Stateless on purpose: serverless functions don't keep memory between
 * requests, so every request gets its own server and transport, with no
 * session id and plain JSON responses instead of SSE streams.
 *
 * Authentication is the caller's job; this function trusts every request.
 */
export async function handleMcpRequest(req: Request): Promise<Response> {
  const server = createAlexandriaServer()
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })

  try {
    await server.connect(transport)
    return await transport.handleRequest(req)
  } finally {
    await server.close()
  }
}
