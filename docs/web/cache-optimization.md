# Cache Optimization & Strategy

This document explains the caching architecture for Astro SSR on Cloudflare Workers — how it differs from traditional static site hosting, and the mechanisms for cache invalidation.

---

## Part 1: The Two-Layer Cache Model

This project uses **server-side rendering (SSR)** on Cloudflare Workers. Every request can be dynamic, and caching happens at two distinct layers:

### Layer 1: Browser Cache
**Controlled by:** `max-age` in Cache-Control header  
**Duration:** 5 minutes (default, configurable per route)  
**Scope:** Per-user, local to the browser  
**Purpose:** Instant navigation on revisit within window

When you prefetch a page via `<link rel="prefetch">` and click it within 5 minutes, the browser serves it instantly from disk cache — no network request.

### Layer 2: Cloudflare Edge Cache
**Controlled by:** `s-maxage` in Cache-Control header  
**Duration:** Up to 1 year (configurable per route)  
**Scope:** Shared across all users worldwide  
**Purpose:** Serve response from Cloudflare's edge without hitting the Worker

When a user visits a page that's cached at the edge, Cloudflare serves the response in milliseconds. The Worker code doesn't run at all.

### How They Work Together

```
┌─────────────────────────────────────────────────────────────┐
│ User Browser                                                 │
├─────────────────────────────────────────────────────────────┤
│ [Browser Cache max-age=300]                                  │
│ If fresh → instant navigation                                │
│ If stale → makes network request                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Cloudflare Edge                                              │
├─────────────────────────────────────────────────────────────┤
│ [Edge Cache s-maxage=31536000, stale-while-revalidate=3600] │
│ If cached & fresh → serve from edge                          │
│ If stale → serve stale while refreshing in background       │
│ If miss → forward to Worker                                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Cloudflare Worker (Astro SSR)                               │
├─────────────────────────────────────────────────────────────┤
│ Renders page on-demand                                       │
│ Fetches from CMS if needed                                   │
│ Sets cache headers in response                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ CMS (Payload)                                               │
├─────────────────────────────────────────────────────────────┤
│ Returns content                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Part 2: SSR vs SSG — Why It Matters

### Static Site Generation (SSG) — What You Used Before

```
Build time:  Astro pre-builds all pages to HTML files
  ↓
Deploy:      Files uploaded to Cloudflare Pages
  ↓
Request:     Cloudflare serves pre-built HTML from edge
  ↓
Result:      Cache-Control headers respected automatically
              No Worker execution needed
```

**Advantages:** Blazingly fast, predictable, minimal CPU cost  
**Disadvantages:** Can't render dynamic content, must rebuild to update content

### Server-Side Rendering (SSR) — What This Project Uses

```
Build time:  Astro builds to Worker entrypoint
  ↓
Deploy:      Worker code uploaded to Cloudflare
  ↓
Request:     Worker ALWAYS runs, renders page on-demand
  ↓
Caching:     Cache-Control headers SET, but don't prevent Worker execution
              (Unless you explicitly use Cache API)
```

**Advantages:** Dynamic content, real-time updates, can respond to per-request state (cookies, headers)  
**Disadvantages:** Worker code runs on every request unless cached via Cache API, more CPU cost

---

## Part 3: Cache Control Directives

### Cache-Control Header Breakdown

Set by `cloudflare-provider.ts`:

```
Cache-Control: public, max-age=300, s-maxage=31536000, stale-while-revalidate=3600
```

| Directive | Scope | Meaning |
|-----------|-------|---------|
| `public` | Both | Response can be cached by any cache (browser, CDN, etc.) |
| `max-age=300` | Browser | Cached for 5 minutes locally |
| `s-maxage=31536000` | Edge | Cached at Cloudflare edge for 1 year |
| `stale-while-revalidate=3600` | Edge | After 1 year, Cloudflare serves stale for 1 more hour while refreshing |

### Special Case: `private, no-store`

When in **editor mode**, the response sets:

```
Cache-Control: private, no-store
```

| Directive | Effect |
|-----------|--------|
| `private` | Only the browser can cache; shared caches (CDN) must not |
| `no-store` | Nothing caches this response at all |

**Important:** This header is a *directive*, not a guarantee. For editor mode, the true protection comes from the worker always running and checking the editor cookie on every request.

---

## Part 4: How SSR Caching Is Configured

### The Idiomatic Astro Approach

Uses Astro's built-in cache system via `cloudflare-provider.ts`, which implements the `CacheProvider` interface:

```typescript
// web/src/lib/cache/cloudflare-provider.ts
export const setHeaders = (options) => {
  if (options.maxAge !== undefined) {
    let value = `public, max-age=300, s-maxage=${options.maxAge}`
    if (options.swr !== undefined) {
      value += `, stale-while-revalidate=${options.swr}`
    }
    headers.set('Cache-Control', value)
  }

  if (options.tags?.length) {
    headers.set('Cache-Tag', options.tags.join(','))
  }

  return headers
}
```

Pages set cache options declaratively:

```astro
---
export const prerender = false

Astro.cache.set({
  maxAge: 31536000,
  swr: 3600,
  tags: ['item-slug', 'items']
})
---
```

Or via route rules in `astro.config.ts`:

```javascript
experimental: {
  routeRules: {
    '/items/*': { maxAge: 31536000, swr: 3600 }
  }
}
```

---

## Part 5: Cache Invalidation Strategy

When content changes in the CMS, cached responses must be cleared. This project implements **tag-based purging**, a three-part pipeline:

### Step 1: CMS Detects Change

When a document is published in Payload, the `afterChange` hook fires:

```typescript
// cms/src/collections/YourCollection.ts
hooks: {
  afterChange: [
    purgeCache((doc) => [`item-${doc.slug}`, 'items']),
  ],
}
```

The hook generates tags based on the document (e.g., `["item-hello", "items"]`).

### Step 2: CMS Calls Frontend Purge Endpoint

The `purgeCache` hook (defined in `cms/src/hooks/purgeCache.ts`) POSTs to the frontend:

```typescript
// cms/src/hooks/purgeCache.ts
await fetch(purgeUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${PURGE_SECRET}`,
  },
  body: JSON.stringify({ tags: resolvedTags }),
})
```

**URL:** `FRONTEND_PURGE_URL` (e.g., `https://your-project.dev/api/cache/purge`)  
**Auth:** `PURGE_SECRET` — shared between CMS and frontend, prevents unauthorized purges

### Step 3: Frontend Purges Cloudflare Cache

The endpoint invalidates cached responses by tag:

```typescript
// web/src/pages/api/cache/purge.ts
export const POST: APIRoute = async (context) => {
  const { tags } = await context.request.json()

  const authHeader = context.request.headers.get('Authorization')
  if (authHeader !== `Bearer ${import.meta.env.PURGE_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  await context.cache.invalidate({ tags })

  return new Response(JSON.stringify({ purged: true, tags }), { status: 200 })
}
```

**Result:** All cached responses tagged with the given tags are immediately evicted from Cloudflare's edge. Next visitor gets a fresh render.

### Tag Naming Convention

Tags are hierarchical and specific:

| Route | Tags | Effect |
|-------|------|--------|
| `/items/{slug}` | `['item-{slug}', 'items']` | Purges the specific item + the items list |
| `/` (home page) | `['home']` | Purges home page |

When editing an item called `hello`, both `item-hello` and `items` are purged:
- The specific item page (`/items/hello`) is refreshed
- Any cached list of items is also refreshed

---

## Part 6: Editor Mode & Cache Control

### The Scenario

In **editor mode** on a page, what happens if you:

1. **Navigate to another page** without exiting editor mode?
2. **Don't save changes** before navigating?

### What Actually Happens

**The Worker Always Runs**

Unlike SSG, the Worker doesn't get bypassed by edge cache. Even with an editor cookie present:

```
Request to /items/hello (with editor cookie)
  ↓
[Worker runs]  ← always happens for SSR
  ↓
Middleware verifies editor cookie
  ↓
Page renders (no editor check for /items/)
  ↓
Sets Cache-Control: public, s-maxage=31536000
  ↓
Cloudflare caches normally
```

The editor cookie alone **does not** skip the edge cache globally. Only pages that explicitly check `Astro.locals.editor` and set `private, no-store` bypass caching.

**Unsaved Changes Are Lost**

Editor components hold state in memory. When you navigate away:

1. Editor component unmounts
2. All unsaved changes evaporate
3. If you navigate back, the editor loads fresh (with blank state)

The editor cookie persists, but the editing session state is gone.

### Why This Is Actually Safe

- ✅ Editor pages set `private, no-store` → not cached
- ✅ Other pages don't check editor → use regular cache
- ✅ Middleware re-verifies editor cookie on every request
- ✅ No stale content is served due to missing editor check
- ❌ But you lose unsaved work if you navigate away

**Recommendation:** Add an unsaved-changes warning before navigation.

---

## Part 7: Private Routes & Authentication

### The Editor Pattern (Covered in `docs/web/editor-pattern.md`)

Pages that need live edits use the **editor pattern**:

1. CMS admin clicks Preview on a document
2. CMS generates a signed JWT (editor token)
3. Frontend redirects to `/api/editor/enter?token=<jwt>`
4. Endpoint verifies token, sets `editor` cookie
5. Middleware re-verifies cookie on every request
6. Page conditionally loads editor UI when `Astro.locals.editor === true`
7. Editor UI is hidden from non-authenticated users

### Cache Headers for Private Routes

When serving authenticated content:

```
Cache-Control: private, no-store
```

- `private` → browsers can cache, but CDNs must not
- `no-store` → strong signal to not cache anywhere

This ensures personalized content (e.g., editor-only UI) isn't served from a shared cache.

---

## Part 8: Performance Implications

### What Gets Cached at the Edge

✅ **Cached:**
- `/items/{slug}` — content detail pages
- `/` (home page, normal mode)

✅ **Cached but short TTL:**
- `/api/*` — API endpoints, with stale-while-revalidate

### What Doesn't Get Cached

❌ **Not cached:**
- `/api/editor/*` — editor endpoints (require verification on every request)
- `/api/cache/purge` — purge requests (must hit server)
- Editor pages in editor mode — set `private, no-store`

### Worker Execution Cost

**Current behavior (without Cache API):**
- Every request triggers full Worker execution
- Astro renders the page
- CMS fetches live data
- Result: High CPU cost on Cloudflare

**Potential optimization (not yet implemented):**
- Use Cloudflare's Cache API to skip rendering on edge hits
- Check cache at Worker start: `caches.default.match(request)`
- Only render on cache miss
- Result: Near-instant responses for cached pages, lower CPU

---

## Part 9: Environment Variables

```bash
# Cloudflare edge cache purging
PURGE_SECRET=<shared secret between CMS and frontend>
FRONTEND_PURGE_URL=https://your-project.dev/api/cache/purge

# CMS side
PREVIEW_SECRET=<shared secret for editor/preview tokens>
FRONTEND_URL=https://your-project.dev

# Frontend side (Cloudflare Workers)
CMS_API_URL=<payload cms api url>
CMS_API_KEY=<api key for write operations>
PREVIEW_SECRET=<same as CMS>
```

---

## Part 10: Best Practices & Checklist

### When Adding a New Page

- [ ] Set `maxAge` and `swr` via `Astro.cache.set()` or route rules
- [ ] Add relevant cache tags (e.g., `['page-type', 'page-id']`)
- [ ] If content comes from CMS, add `afterChange` hook to purge tags on update
- [ ] If content is user-specific or authenticated, use `private, no-store`

### When Updating Cache Strategy

- [ ] Keep tag naming consistent and hierarchical
- [ ] Document which pages/endpoints purge which tags
- [ ] Test cache invalidation: publish in CMS → verify edge cache is purged
- [ ] Monitor Worker CPU usage: high usage indicates few cache hits

### When Debugging Cache Issues

Check the `cf-cache-status` response header:
- `HIT` — served from Cloudflare edge cache
- `MISS` — not in cache, had to fetch from Worker
- `EXPIRED` — was cached but TTL exceeded
- `BYPASS` — cache was bypassed (e.g., `private, no-store`)

### Stale-While-Revalidate Pattern

The `swr` window allows serving stale content while refreshing in background:

```
t=0s    → Response cached with s-maxage=31536000, swr=3600
t=1 year → Response becomes stale
t=1-2 years → Within SWR: Cloudflare serves stale instantly + refreshes in background
t=2 years → SWR expires: must fetch fresh (blocks user)
```

This provides a graceful degradation period where stale content is acceptable.

---

## Part 11: Original Code Documentation

The following sections are extracted from `web/src/lib/cache/cloudflare-provider.ts`, which is the canonical reference implementation.

### How the cache layers work

There are two distinct caches involved in every page request:

**1. Cloudflare edge cache** — lives on Cloudflare's servers worldwide.
- Controlled by `s-maxage` in Cache-Control
- Shared between all users
- When a page is cached here, Cloudflare serves it directly without spinning up the Worker at all — essentially free and instant

**2. Browser cache** — lives on the user's machine.
- Controlled by `max-age` in Cache-Control
- Private to each user
- When a page is cached here, the browser uses it without any network request at all — not even to Cloudflare

### s-maxage vs max-age

Both are standard HTTP Cache-Control directives in the same header:

```
Cache-Control: public, max-age=300, s-maxage=31536000, stale-while-revalidate=3600
```

- **max-age=300** → browser caches for 5 minutes (ignores s-maxage)
- **s-maxage=31536000** → Cloudflare edge caches for 1 year (browsers ignore s-maxage)
- **stale-while-revalidate=3600** → after s-maxage expires, Cloudflare serves stale content for 1 more hour while refreshing in background

Cloudflare passes the full Cache-Control header downstream to the browser as-is. The browser reads max-age, ignores s-maxage. The CDN reads s-maxage, uses it to override max-age for edge TTL. This is confirmed Cloudflare behavior: https://developers.cloudflare.com/cache/concepts/cache-control/

### Tag-based purging

Each response is tagged via the Cache-Tag header. When content changes in the CMS, the `/api/cache/purge` endpoint calls Cloudflare's API to purge all responses with matching tags — instantly evicting them from the edge cache regardless of s-maxage.

After purge: next visitor triggers a fresh Worker render, new response gets cached for another year. No staleness, no waiting.

### Why 5 minutes in the browser

Astro's ClientRouter (SPA-style navigation) uses `<link rel="prefetch">` to pre-download pages the user is likely to visit next. Prefetch stores the response in the browser's HTTP disk cache.

When the user actually clicks the link, the browser checks its cache:
- If the response is still fresh (within max-age) → used instantly, no request
- If max-age has expired → browser must revalidate with Cloudflare first (sends a conditional GET; Cloudflare returns 304 Not Modified if unchanged)

Unlike `<link rel="preload">` (which is for current-page resources and often NOT reused for navigation), `rel="prefetch"` IS specifically designed for next-page navigation. MDN confirms it uses the same Accept header as real navigations, so the prefetched response CAN be reused when the user navigates.

Reference: https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/rel/prefetch

**IMPORTANT:** Cache-Control headers like no-cache or no-store block prefetch reuse entirely. The browser stores the response but must revalidate before using it, defeating the purpose of prefetching for instant navigation.

With max-age=300: if the user clicks a prefetched link within 5 minutes, navigation is instant (no network request). After 5 minutes, a round-trip to Cloudflare is needed — but Cloudflare's edge cache makes this very fast.

### Browser cache staleness window

If content changes in the CMS:
- Cloudflare edge cache is purged immediately via Cache-Tag
- Browser cache is NOT purgeable remotely — users may see stale content for up to 5 minutes (the max-age window)

For content that rarely changes, this is acceptable. A hard refresh (Ctrl+Shift+R) bypasses browser cache if needed during editing.

**Timeline example with max-age=5, swr=30 (illustrative small values):**
- t=0s → prefetch happens, response stored fresh
- t=5s → entry becomes stale (max-age expired)
- t=5-35s → within stale-while-revalidate window: browser MAY serve stale instantly + trigger background revalidation
- t=60s → both max-age AND swr expired → browser MUST block and revalidate before using it (round-trip required, no instant navigation)

---

## Summary

The caching architecture balances **freshness** (dynamic SSR) with **performance** (edge caching). The three-layer system (browser → edge → worker) provides instant navigation for recent visits while keeping content fresh via tag-based purging. Understanding when to cache, how to invalidate, and when to bypass cache is key to maintaining both performance and correctness.

### Code Reference

The cache provider implementation is in `web/src/lib/cache/cloudflare-provider.ts`. See this file for implementation details and keep comments in sync with this documentation.

For detailed implementation patterns, see:
- `docs/web/editor-pattern.md` — authentication and live editing
- `docs/web/preview.md` — draft content previews
- `docs/web/frontend-guidelines.md` — Svelte/SCSS patterns
- `web/src/lib/cache/cloudflare-provider.ts` — implementation reference
