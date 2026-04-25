# Editor Pattern — Auth-Gated Write Proxy

The editor pattern lets CMS editors make live edits to specific pages from the frontend, bypassing the CDN cache and writing changes back through Payload.

## How it works

1. CMS admin preview button signs an HMAC JWT and redirects to `/api/editor/enter?token=<jwt>`
2. The frontend validates the token, stores it in an `editor` cookie, and redirects to the page
3. On every request, `web/src/middleware.ts` re-verifies the cookie's HMAC signature
4. When the editor saves changes, the browser POSTs to `/api/editor/save`
5. The save proxy verifies the cookie, then forwards the write to Payload using `CMS_API_KEY` (never exposed to the browser)

## Security model

| Property | Detail |
|---|---|
| Token contents | `{ role, doc, userId, exp }` — signed with HMAC-SHA256 |
| Secret | `PREVIEW_SECRET`, shared between CMS and web via `.env` |
| Expiry | 2 hours from generation (configurable in `signHmacToken`) |
| Key exposure | `CMS_API_KEY` never reaches the browser — all writes go through the server-side proxy |

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

## Porting

When adding editor functionality to a new collection/page:

1. Add an `admin.preview` function in the CMS collection config that calls `signHmacToken(role, slug, userId)` and builds the redirect URL
2. Create a save endpoint modelled on `web/src/pages/api/editor/save.ts` — change the fetch URL to target your collection/global
3. On the frontend page, check `Astro.locals.editor` to conditionally load the editor UI and set `Cache-Control: private, no-store`

The HMAC utilities (`hmac-token.ts`) and middleware pattern are generic and need no changes.
