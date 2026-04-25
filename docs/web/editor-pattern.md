# Editor Pattern — Auth-Gated Write Proxy

The editor pattern lets CMS editors make live edits to specific pages from the frontend, bypassing the CDN cache and writing changes back through Payload.

## Complete Flow

### 1. Entry Point — CMS Admin Preview Button

In the CMS admin UI, when editing a collection or global, a **Preview** button appears in the top-right. Clicking it:

```typescript
// cms/src/collections/YourCollection.ts (or globals/YourGlobal.ts)
export const YourCollection: CollectionConfig = {
  slug: 'your-collection',
  admin: {
    preview: async (_doc, { req }) => {
      if (!req.user) return null
      const token = await signHmacToken(String(req.user.id))
      const base = process.env.FRONTEND_URL ?? 'http://localhost:4321'
      return `${base}/api/editor/enter?token=${token}`
    },
  },
  // ...
}
```

The preview function:
- Checks if user is authenticated
- Calls `signHmacToken()` to generate a signed JWT
- Returns a URL pointing to `/api/editor/enter?token=<jwt>`
- Clicking this link redirects the user to the frontend with the token in the query string

### 2. Token Generation (CMS-side)

The `signHmacToken()` function signs a JWT using Node.js `crypto.subtle`:

```typescript
// cms/src/lib/hmac-token.ts
export interface EditorTokenPayload {
  role: 'editor'
  doc: string  // scoped to which document type/slug
  userId: string
  exp: number
}

export async function signHmacToken(
  userId: string,
  expiresInSeconds = 60 * 60 * 2,  // 2 hours default
): Promise<string> {
  const secret = process.env.PREVIEW_SECRET
  if (!secret) throw new Error('PREVIEW_SECRET not set')

  const header = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = base64urlEncode(
    JSON.stringify({
      role: 'editor',
      doc: 'your-collection',
      userId,
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    } satisfies EditorTokenPayload),
  )

  const message = `${header}.${payload}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign(
    { name: 'HMAC', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(message),
  )
  return `${message}.${base64urlEncode(sig)}`
}
```

The token is signed with `PREVIEW_SECRET` (shared between CMS and frontend) using HMAC-SHA256.

### 3. Token Exchange — Frontend Entry

When the user follows the preview link, `/api/editor/enter` validates the token:

```typescript
// web/src/pages/api/editor/enter.ts
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
```

The endpoint:
- Extracts the token from query string
- Verifies the HMAC signature using `verifyHmacToken()` (frontend version of the CMS signer)
- Sets an `editor` cookie with the full JWT
- Redirects to `/` (or the edited page)

### 4. Middleware Re-verification

On every request, `web/src/middleware.ts` verifies the editor cookie:

```typescript
// web/src/middleware.ts
export const onRequest = defineMiddleware(async (context, next) => {
  const cookie = context.cookies.get('editor')?.value
  const secret = import.meta.env.PREVIEW_SECRET
  context.locals.editor = cookie ? Boolean(await verifyHmacToken(cookie, secret)) : false
  return next()
})
```

- Reads the `editor` cookie
- Re-verifies the HMAC signature
- Sets `context.locals.editor` for the page to use
- If the token is expired or invalid, `context.locals.editor` becomes `false`

### 5. Conditional Component Rendering

The page reads `Astro.locals.editor` and conditionally loads the editor UI:

```typescript
// web/src/pages/your-page.astro
const { editor } = Astro.locals

if (editor) {
  Astro.response.headers.set('Cache-Control', 'private, no-store')
}
```

```svelte
<!-- web/src/components/YourComponent.svelte -->
<script lang="ts">
  interface Props {
    data: YourData
    editor: boolean
  }

  const { data, editor } = $props()

  const editorModulePromise = $derived(
    editor ? import('./YourEditor.svelte') : null,
  )
</script>

{#if editorModulePromise}
  {#await editorModulePromise then mod}
    <mod.default {data} />
  {/await}
{/if}
```

When `editor` is `true`:
- Cache headers are set to `private, no-store` to prevent CDN caching
- The editor component is dynamically imported
- Only after the component is loaded can the user make edits

### 6. Saving Changes

When the user saves from the editor UI, the browser POSTs to `/api/editor/save`:

```typescript
// web/src/pages/api/editor/save.ts
export const POST: APIRoute = async ({ request, cookies }) => {
  const cookie = cookies.get('editor')?.value
  const secret = import.meta.env.PREVIEW_SECRET
  const payload = await verifyHmacToken(cookie, secret)

  if (!payload) {
    return new Response('Unauthorized', { status: 401 })
  }

  const body = await request.json()

  const res = await fetch(`${import.meta.env.CMS_API_URL}/globals/your-global`, {
    method: 'PATCH',
    headers: {
      Authorization: `users API-Key ${import.meta.env.CMS_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  return new Response(await res.text(), { status: res.status })
}
```

The endpoint:
- Verifies the editor cookie again
- Forwards the write to Payload using `CMS_API_KEY` (never exposed to the browser)
- Returns the result to the frontend

### 7. Exit / Logout

The editor UI has an **Exit** button that POSTs to `/api/editor/exit`:

```typescript
// web/src/pages/api/editor/exit.ts
export const POST: APIRoute = async ({ cookies, redirect }) => {
  cookies.delete('editor', { path: '/' })
  return redirect('/', 303)
}
```

```svelte
<!-- YourToolbar.svelte (example) -->
<form method="POST" action="/api/editor/exit" style="display:contents;">
  <button type="submit">Exit</button>
</form>
```

When clicked:
- The `editor` cookie is deleted
- User is redirected to `/` without editor mode
- Next request: middleware finds no cookie, `context.locals.editor` becomes `false`
- Editor UI is no longer rendered

## Security Model

| Property | Detail |
|---|---|
| **Token format** | HMAC-SHA256 signed JWT with `{ role, doc, userId, exp }` |
| **Secret** | `PREVIEW_SECRET`, shared between CMS and web via `.env` |
| **Expiry** | Configurable (default 2 hours from generation) — set in `signHmacToken(userId, expiresInSeconds)` |
| **Re-verification** | Every request via middleware — cookie must pass HMAC validation |
| **API key exposure** | `CMS_API_KEY` never reaches the browser — save proxy forwards writes server-to-server |
| **Cache bypass** | When `editor` is true, response headers set `Cache-Control: private, no-store` |
| **Token scope** | Scoped per-document type (e.g., `doc: 'your-collection'`) — a token for one document won't work for another |

## Comparison with Draft Preview

| Aspect | Draft Preview | Editor Pattern |
|---|---|---|
| Purpose | Preview unpublished content | Make live edits to published content |
| Direction | CMS → frontend, read-only | Browser ↔ frontend proxy ↔ CMS, read-write |
| Cookie value | `draft=true` (boolean flag) | Full HMAC JWT |
| Re-verification | Once on enter, then just reads the boolean | Every request via middleware |
| Shareable URL | Yes — token is one-time to set cookie | No — tied to editor session |
| CDN cache | Bypassed during preview | Bypassed when editor cookie present |
| API key | Read-only key is sufficient | Write-capable `CMS_API_KEY` required |

## Environment variables

```
# Needs write access — the editor proxy writes through the same key
CMS_API_KEY=your-cms-api-key

# Shared HMAC secret (same as preview)
PREVIEW_SECRET=your-preview-secret
```

## Relevant files

| File | Role |
|---|---|
| `cms/src/lib/hmac-token.ts` | Signs the HMAC JWT (Node.js `crypto.subtle`) |
| `web/src/utils/hmac-token.ts` | Verifies the HMAC JWT (Workers `crypto.subtle`) |
| `web/src/middleware.ts` | Re-verifies the editor cookie on every request |
| `web/src/pages/api/editor/enter.ts` | Validates token, sets `editor` cookie, redirects |
| `web/src/pages/api/editor/exit.ts` | Clears the `editor` cookie |
| `web/src/pages/api/editor/save.ts` | Auth-gated write proxy to Payload |

## Porting to Another Collection

When adding editor functionality to a new collection/page:

### CMS Side

1. In the collection config, add an `admin.preview` function (see step 1 of the flow above):
   ```typescript
   // cms/src/collections/YourCollection.ts
   import { signHmacToken } from '@/lib/hmac-token'

   export const YourCollection: CollectionConfig = {
     slug: 'your-collection',
     admin: {
       preview: async (_doc, { req }) => {
         if (!req.user) return null
         const token = await signHmacToken(String(req.user.id))
         const base = process.env.FRONTEND_URL ?? 'http://localhost:4321'
         return `${base}/api/editor/enter?token=${token}`
       },
     },
     // ...
   }
   ```

### Frontend Side

2. Create a save endpoint modelled on `/api/editor/save.ts`, changing the fetch URL to target your collection:
   ```typescript
   // web/src/pages/api/editor/your-collection.ts
   export const POST: APIRoute = async ({ request, cookies }) => {
     const cookie = cookies.get('editor')?.value
     const secret = import.meta.env.PREVIEW_SECRET
     const payload = await verifyHmacToken(cookie, secret)

     if (!payload) return new Response('Unauthorized', { status: 401 })

     const body = await request.json()
     const res = await fetch(`${import.meta.env.CMS_API_URL}/collections/your-collection/${body.id}`, {
       method: 'PATCH',
       headers: {
         Authorization: `users API-Key ${import.meta.env.CMS_API_KEY}`,
         'Content-Type': 'application/json',
       },
       body: JSON.stringify(body),
     })

     return new Response(await res.text(), { status: res.status })
   }
   ```

3. On your frontend page, check `Astro.locals.editor` and set cache headers:
   ```typescript
   // web/src/pages/your-page.astro
   const { editor } = Astro.locals

   if (editor) {
     Astro.response.headers.set('Cache-Control', 'private, no-store')
   }
   ```

4. In your component, conditionally render the editor:
   ```svelte
   <!-- Svelte component -->
   <script lang="ts">
     interface Props {
       editor: boolean
     }

     const { editor } = $props()

     const editorModulePromise = $derived(
       editor ? import('./YourEditor.svelte') : null,
     )
   </script>

   {#if editorModulePromise}
     {#await editorModulePromise then mod}
       <mod.default {...editorProps} />
     {/await}
   {/if}
   ```

### Notes

- The HMAC utilities (`verifyHmacToken` in frontend, `signHmacToken` in CMS) are generic and require no changes.
- Middleware is generic — no changes needed.
- The `/api/editor/enter` and `/api/editor/exit` endpoints are reusable across all editor implementations.
- Only customize the save endpoint to match your collection's API endpoint.
- For Payload **globals** use `/globals/your-global` in the fetch URL; for **collections** use `/collections/your-collection/:id`.
