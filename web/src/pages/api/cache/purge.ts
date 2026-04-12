import type { APIRoute } from 'astro'

export const POST: APIRoute = async (context) => {
  const authHeader = context.request.headers.get('Authorization')
  const expected = `Bearer ${import.meta.env.PURGE_SECRET}`

  if (!authHeader || authHeader !== expected) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const body = await context.request.json()
  const { tags } = body

  if (!tags || !Array.isArray(tags)) {
    return new Response(JSON.stringify({ error: 'Invalid body: tags array required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    await context.cache.invalidate({ tags })
    return new Response(JSON.stringify({ purged: true, tags }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalidation failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
