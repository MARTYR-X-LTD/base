// HMAC JWT signer — library-free HMAC-SHA256 token generation.
//
// This is the CMS-side signer for creating role-scoped tokens (e.g. editor
// access, admin preview) that the frontend verifies via Web Crypto API.
//
// Compare with preview-token.ts which uses the same base64url + HMAC pattern
// but with a different payload shape ({ slug, collection }) for read-only
// draft preview. This signer is for tokens that grant write capability —
// the payload is generic (role, doc, userId) so the frontend can re-verify
// the token on every request and know exactly what the bearer is allowed to do.
//
// The paired verifier lives in web/src/utils/hmac-token.ts.

const ALGO = { name: 'HMAC', hash: 'SHA-256' }

function base64urlEncode(input: string | ArrayBuffer): string {
  const bytes =
    typeof input === 'string' ? Buffer.from(input, 'utf8') : Buffer.from(input)
  return bytes.toString('base64url')
}

export interface HmacTokenPayload {
  role: string
  doc: string
  userId: string
  exp: number
}

export async function signHmacToken(
  role: string,
  doc: string,
  userId: string,
  expiresInSeconds = 60 * 60 * 2,
): Promise<string> {
  const secret = process.env.PREVIEW_SECRET
  if (!secret) throw new Error('PREVIEW_SECRET not set')

  const header = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = base64urlEncode(
    JSON.stringify({
      role,
      doc,
      userId,
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    } satisfies HmacTokenPayload),
  )

  const message = `${header}.${payload}`

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    ALGO,
    false,
    ['sign'],
  )

  const sig = await crypto.subtle.sign(ALGO, key, new TextEncoder().encode(message))
  return `${message}.${base64urlEncode(sig)}`
}
