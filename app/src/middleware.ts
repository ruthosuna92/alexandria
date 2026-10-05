import { NextRequest, NextResponse } from 'next/server'

// Protects every page and API route with HTTP Basic Auth. The browser prompts
// once and then sends the credentials on every same-origin fetch, so the UI
// needs no changes. /api/gpt/* is excluded in `config.matcher` because the
// ChatGPT action authenticates with its own bearer key.

// Edge runtime has no crypto.timingSafeEqual; compare every character so the
// response time doesn't reveal how much of the password matched.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function unauthorized() {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Alexandria", charset="UTF-8"' },
  })
}

export function middleware(req: NextRequest) {
  const user = process.env.ALEXANDRIA_USER
  const password = process.env.ALEXANDRIA_PASSWORD

  // Fail closed: a missing env var must never leave the app open.
  if (!user || !password) {
    return new NextResponse('Auth is not configured: set ALEXANDRIA_USER and ALEXANDRIA_PASSWORD', { status: 500 })
  }

  const header = req.headers.get('authorization')
  if (!header?.startsWith('Basic ')) return unauthorized()

  let decoded: string
  try {
    decoded = atob(header.slice('Basic '.length))
  } catch {
    return unauthorized()
  }

  const separator = decoded.indexOf(':')
  if (separator === -1) return unauthorized()

  const givenUser = decoded.slice(0, separator)
  const givenPassword = decoded.slice(separator + 1)

  // Evaluate both so a wrong user takes as long as a wrong password.
  const userOk = safeEqual(givenUser, user)
  const passwordOk = safeEqual(givenPassword, password)
  if (!userOk || !passwordOk) return unauthorized()

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/gpt/).*)'],
}
