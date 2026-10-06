import { createRemoteJWKSet, jwtVerify } from 'jose'

// OAuth 2.1 for the remote MCP endpoint. Supabase Auth is the authorization
// server and issues the access tokens; /api/mcp is the resource server and
// only verifies them. Only Alexandria's owner (ALEXANDRIA_OWNER_ID) gets in.

export const MCP_PATH = '/api/mcp'
export const RESOURCE_METADATA_PATH = '/.well-known/oauth-protected-resource'

function authServerUrl(): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  return supabaseUrl ? `${supabaseUrl}/auth/v1` : null
}

let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null

function getJwks(issuer: string) {
  // jose caches the keys and refetches them when Supabase rotates them.
  if (!_jwks) _jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`))
  return _jwks
}

/** RFC 9728 metadata telling MCP clients which authorization server to use. */
export function resourceMetadata(origin: string) {
  return {
    resource: `${origin}${MCP_PATH}`,
    authorization_servers: [authServerUrl()],
    bearer_methods_supported: ['header'],
  }
}

function challenge(origin: string, status: 401 | 403, error?: 'invalid_token' | 'insufficient_scope') {
  const params = [`resource_metadata="${origin}${RESOURCE_METADATA_PATH}${MCP_PATH}"`]
  if (error) params.push(`error="${error}"`)
  return Response.json(
    { error: status === 401 ? 'Unauthorized' : 'Forbidden' },
    { status, headers: { 'WWW-Authenticate': `Bearer ${params.join(', ')}` } }
  )
}

/**
 * Returns null when the request carries a valid Supabase access token for the
 * owner, or the 401/403/500 response to send back otherwise. Fails closed when
 * the env vars are missing.
 */
export async function checkMcpAuth(req: Request): Promise<Response | null> {
  const origin = new URL(req.url).origin
  const issuer = authServerUrl()
  const ownerId = process.env.ALEXANDRIA_OWNER_ID

  if (!issuer || !ownerId) {
    return Response.json(
      { error: 'Auth is not configured: set NEXT_PUBLIC_SUPABASE_URL and ALEXANDRIA_OWNER_ID' },
      { status: 500 }
    )
  }

  const header = req.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return challenge(origin, 401)

  let sub: string | undefined
  try {
    const { payload } = await jwtVerify(header.slice('Bearer '.length), getJwks(issuer), {
      issuer,
      audience: 'authenticated',
      algorithms: ['ES256'],
    })
    sub = payload.sub
  } catch {
    return challenge(origin, 401, 'invalid_token')
  }

  // A valid token from any other Supabase user is authenticated but not allowed.
  if (sub !== ownerId) return challenge(origin, 403, 'insufficient_scope')

  return null
}
