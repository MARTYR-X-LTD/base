import type { APIRoute } from 'astro'

export const GET: APIRoute = async ({ cookies, redirect }) => {
  cookies.delete('editor', { path: '/' })
  return redirect('/', 307)
}

export const POST: APIRoute = async ({ cookies, redirect }) => {
  cookies.delete('editor', { path: '/' })
  return redirect('/', 303)
}
