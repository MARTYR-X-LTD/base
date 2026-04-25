import type { APIRoute } from 'astro'
import { verifyHmacToken } from '@/utils/hmac-token'

// Auth-gated Payload write proxy.
//
// The browser never talks to Payload directly — all writes go through this
// proxy endpoint, which verifies the HMAC-signed editor cookie on every
// request and forwards the write to Payload using the CMS_API_KEY (which
// never leaves the server).
//
// This endpoint is a reference example. When porting to a new project:
// 1. Change the fetch URL to match your collection/global
// 2. Adjust the body shape as needed
// 3. Keep the auth pattern (cookie re-verification via verifyHmacToken)
//
// Without this proxy, you'd either need to:
//   a) Expose CMS_API_KEY to the browser (security risk)
//   b) Run a separate auth service (overkill for portfolio sites)
//
// The proxy pattern keeps the API key server-side while the browser only
// holds an HMAC-signed cookie with limited expiry.
export const POST: APIRoute = async ({ request, cookies }) => {
  const cookie = cookies.get('editor')?.value
  const secret = import.meta.env.PREVIEW_SECRET
  const token = cookie ? await verifyHmacToken(cookie, secret) : null
  if (!token) return new Response('Unauthorized', { status: 401 })

  const apiUrl = import.meta.env.CMS_API_URL
  const apiKey = import.meta.env.CMS_API_KEY
  if (!apiUrl || !apiKey) {
    return new Response('Server misconfigured', { status: 500 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const res = await fetch(`${apiUrl}/globals/home-grid`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `users API-Key ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  return new Response(text, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'application/json',
      'Cache-Control': 'private, no-store',
    },
  })
}
