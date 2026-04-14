import type { APIRoute } from 'astro'
import { verifyPreviewToken } from '@/utils/preview-token'

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const token = url.searchParams.get('token')

  if (!token) {
    return new Response('Missing preview token', { status: 400 })
  }

  const payload = await verifyPreviewToken(token, import.meta.env.PREVIEW_SECRET)

  if (!payload) {
    return new Response('Invalid or expired preview token', { status: 401 })
  }

  const { slug, collection } = payload

  cookies.set('draft', 'true', {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours — matches token expiry
  })

  const redirectMap: Record<string, string> = {
    works: `/work/${slug}`,
    'store-products': `/store/${slug}`,
  }

  const targetPath = redirectMap[collection] ?? '/'
  return redirect(targetPath, 307)
}
