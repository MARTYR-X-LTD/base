import type { APIRoute } from 'astro'
import { verifyHmacToken } from '@/utils/hmac-token'

// Editor enter route — validates an HMAC-signed token from the CMS admin
// preview button, stores the full token in an httpOnly cookie, and
// redirects the editor to the frontend.
//
// Unlike preview/enter which sets a boolean "draft" cookie after one-time
// verification, this route stores the entire token so the middleware can
// re-verify the HMAC signature + expiry on every subsequent request.
// The cookie maxAge matches the token's remaining TTL so both expire together.
//
// See docs/web/editor-pattern.md for the full pattern comparison.
export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const token = url.searchParams.get('token')
  if (!token) return new Response('Missing editor token', { status: 400 })

  const secret = import.meta.env.PREVIEW_SECRET
  const payload = await verifyHmacToken(token, secret)
  if (!payload) return new Response('Invalid or expired editor token', { status: 401 })

  const remainingSeconds = Math.max(0, payload.exp - Math.floor(Date.now() / 1000))

  cookies.set('editor', token, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: remainingSeconds,
  })

  return redirect('/', 307)
}
