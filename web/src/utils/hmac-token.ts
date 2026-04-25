// HMAC JWT verifier — library-free HMAC-SHA256 token verification.
//
// Paired with cms/src/lib/hmac-token.ts on the CMS side. Verifies tokens
// using Web Crypto API (works in Cloudflare Workers, no Node.js deps).
//
// Unlike preview-token.ts which sets a boolean "draft" cookie after a single
// verification, this verifier is designed for middleware re-verification on
// every request: the full token is stored in the cookie so the middleware
// can check the HMAC signature + expiry before trusting the session.
//
// Pattern: CMS signs → frontend receives token via query param → stores
// full token in httpOnly cookie → middleware reads cookie, calls verifyHmacToken
// on every request → if valid, grants write access.

const ALGO = { name: 'HMAC', hash: 'SHA-256' }

function base64urlDecodeToString(str: string): string {
  return atob(str.replace(/-/g, '+').replace(/_/g, '/'))
}

function base64urlDecodeToBuffer(str: string): ArrayBuffer {
  const binary = atob(str.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

export interface HmacTokenPayload {
  role: string
  doc: string
  userId: string
  exp: number
}

export async function verifyHmacToken(
  token: string,
  secret: string,
): Promise<HmacTokenPayload | null> {
  if (!token || !secret) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [header, payload, sig] = parts
  const message = `${header}.${payload}`

  let key: CryptoKey
  try {
    key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      ALGO,
      false,
      ['verify'],
    )
  } catch {
    return null
  }

  const valid = await crypto.subtle.verify(
    ALGO,
    key,
    base64urlDecodeToBuffer(sig),
    new TextEncoder().encode(message),
  )
  if (!valid) return null

  let data: HmacTokenPayload
  try {
    data = JSON.parse(base64urlDecodeToString(payload))
  } catch {
    return null
  }

  if (data.exp < Math.floor(Date.now() / 1000)) return null

  return data
}
