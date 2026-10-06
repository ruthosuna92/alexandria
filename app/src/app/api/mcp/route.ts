import { NextResponse } from 'next/server'
import { handleMcpRequest } from '../../../../../mcp/http'
import { checkMcpAuth } from '@/lib/mcp-auth'

// Remote MCP endpoint (Streamable HTTP) exposing the same tools as the local
// stdio server. Excluded from Basic Auth: it requires a Supabase OAuth access
// token for the owner instead (see lib/mcp-auth.ts).

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const denied = await checkMcpAuth(req)
  if (denied) return denied
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
