import { base64urlDecodeToString, base64urlDecodeToBuffer } from '@/utils/base64url'

const ALGO = { name: 'HMAC', hash: 'SHA-256' }

export interface PreviewTokenPayload {
  slug: string
  collection: string
  exp: number
}

export async function verifyPreviewToken(
  token: string,
  secret: string,
): Promise<PreviewTokenPayload | null> {
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

  let data: PreviewTokenPayload
  try {
    data = JSON.parse(base64urlDecodeToString(payload))
  } catch {
    return null
  }

  if (data.exp < Math.floor(Date.now() / 1000)) return null

  return data
}
