import { NextResponse } from 'next/server'
import { handleMcpRequest } from '../../../../../mcp/http'

// Remote MCP endpoint (Streamable HTTP) exposing the same tools as the local
// stdio server. For now it sits behind the app-wide Basic Auth in middleware.ts.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  return handleMcpRequest(req)
}

// Stateless server: no SSE stream to open (GET) and no session to end (DELETE).
function methodNotAllowed() {
  return NextResponse.json(
    { jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed' }, id: null },
    { status: 405, headers: { Allow: 'POST' } }
  )
}

export const GET = methodNotAllowed
export const DELETE = methodNotAllowed
