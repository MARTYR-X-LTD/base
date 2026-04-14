const ALGO = { name: 'HMAC', hash: 'SHA-256' }

function base64urlEncode(input: string | ArrayBuffer): string {
  const bytes =
    typeof input === 'string' ? Buffer.from(input, 'utf8') : Buffer.from(input)
  return bytes.toString('base64url')
}

export async function signPreviewToken(
  slug: string,
  collection: string,
  expiresInSeconds = 86400, // 24 hours
): Promise<string> {
  const secret = process.env.PREVIEW_SECRET!

  const header = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = base64urlEncode(
    JSON.stringify({
      slug,
      collection,
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    }),
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
