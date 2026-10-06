// Shared by the middleware (edge runtime) and API routes, so it only uses
// APIs available in both. Edge has no crypto.timingSafeEqual.

/** Compares every character so response time doesn't reveal how much matched. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * True only when ALEXANDRIA_API_KEY is set and the request sends it as a
 * bearer token. Fails closed when the env var is missing.
 */
export function hasValidApiKey(authorization: string | null): boolean {
  const apiKey = process.env.ALEXANDRIA_API_KEY
  if (!apiKey || !authorization?.startsWith('Bearer ')) return false
  return safeEqual(authorization.slice('Bearer '.length), apiKey)
}
