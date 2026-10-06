import { resourceMetadata } from '@/lib/mcp-auth'

// Serves both /.well-known/oauth-protected-resource and the path-suffixed
// form /.well-known/oauth-protected-resource/api/mcp that MCP clients try.
// Public on purpose: it only says where to get a token.

export const dynamic = 'force-dynamic'

export function GET(req: Request) {
  return Response.json(resourceMetadata(new URL(req.url).origin))
}
