# Draft Preview

Editors can preview unpublished (draft) content from the Payload admin UI. The resulting URL is shareable with anyone — no Payload account required — and expires after 24 hours.

## How it works

1. Open any Work or Store Product in the Payload admin
2. Click the **Preview** button (top-right of the edit view)
3. A new tab opens at `/api/preview/enter?token=<jwt>`
4. The frontend validates the token, sets a `draft=true` cookie, and redirects to the content page
5. The page reads `Astro.cookies.get('draft')` and passes `draft: true` through the live loader filter
6. The Payload CMS loader appends `?draft=true` to the API call, returning unpublished changes

The preview URL is safe to copy and share. It contains a signed JWT — no master secret is exposed.

## Security model

| Property | Detail |
|---|---|
| Token contents | `{ slug, collection, exp }` — signed with HMAC-SHA256 |
| Secret | `PREVIEW_SECRET`, shared between CMS and web via `.env` |
| Expiry | 24 hours from generation |
| Scope | Scoped per-document (a token for `work-a` won't preview `work-b`) |
| Revocation | Not supported — acceptable for portfolio use |

## Environment variables

Both CMS and web must have these set:

```
PREVIEW_SECRET=<shared secret>   # used to sign and verify tokens
FRONTEND_URL=https://monk.dev    # CMS uses this to build the preview URL (cms only)
```

`FRONTEND_URL` defaults to `http://localhost:4321` in development if unset.

## Relevant files

| File | Role |
|---|---|
| `cms/src/lib/preview-token.ts` | Signs the JWT (Node.js `crypto.subtle`) |
| `cms/src/collections/Works.ts` | `admin.preview` — generates the preview URL |
| `cms/src/collections/StoreProducts.ts` | `admin.preview` — same |
| `web/src/utils/preview-token.ts` | Verifies the JWT (Cloudflare Workers `crypto.subtle`) |
| `web/src/pages/api/preview/enter.ts` | Validates token, sets `draft` cookie, redirects |
| `web/src/pages/api/preview/exit.ts` | Clears the `draft` cookie |
| `web/src/lib/loaders/payload.ts` | Reads `context.filter.draft` to fetch draft content |
