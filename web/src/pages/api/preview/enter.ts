import type { APIRoute } from 'astro'

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const secret = url.searchParams.get('secret')
  const slug = url.searchParams.get('slug')
  const collection = url.searchParams.get('collection')

  if (secret !== import.meta.env.PREVIEW_SECRET) {
    return new Response('Invalid preview secret', { status: 401 })
  }

  if (!slug || !collection) {
    return new Response('Missing slug or collection', { status: 400 })
  }

  // Set draft cookie
  cookies.set('draft', 'true', {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60, // 1 hour
  })

  // Redirect to the content page
  const redirectMap: Record<string, string> = {
    works: `/work/${slug}`,
    'store-products': `/store/${slug}`,
  }

  const targetPath = redirectMap[collection] ?? '/'
  return redirect(targetPath, 307)
}
