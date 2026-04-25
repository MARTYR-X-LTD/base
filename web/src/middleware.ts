import { defineMiddleware } from 'astro:middleware'
import { verifyHmacToken } from '@/utils/hmac-token'

// Middleware that verifies the editor cookie's HMAC signature on every request.
//
// Without this check, any request bearing a cookie named "editor" would be
// treated as authenticated — a forged cookie would grant write access.
// By storing the full HMAC-signed JWT in the cookie (not just a boolean flag),
// we can re-verify the signature + expiry on every request.
//
// This is a different pattern from the draft preview (which sets a simple
// "draft=true" boolean cookie after one-time verification). The preview
// only needs read access to unpublished content; the editor needs write
// access, so every request is independently verified.
export const onRequest = defineMiddleware(async (context, next) => {
  const cookie = context.cookies.get('editor')?.value
  const secret = import.meta.env.PREVIEW_SECRET
  context.locals.editor = cookie
    ? Boolean(await verifyHmacToken(cookie, secret))
    : false
  return next()
})
