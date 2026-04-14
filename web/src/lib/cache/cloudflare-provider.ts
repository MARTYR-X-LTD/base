import type { CacheProviderFactory } from 'astro'

/**
 * Cloudflare CDN cache provider for Astro SSR.
 *
 * ─── HOW THE CACHE LAYERS WORK ───────────────────────────────────────────────
 *
 * There are two distinct caches involved in every page request:
 *
 *   1. CLOUDFLARE EDGE CACHE — lives on Cloudflare's servers worldwide.
 *      Controlled by `s-maxage` in Cache-Control. Shared between all users.
 *      When a page is cached here, Cloudflare serves it directly without
 *      spinning up the Worker at all — essentially free and instant.
 *
 *   2. BROWSER CACHE — lives on the user's machine.
 *      Controlled by `max-age` in Cache-Control. Private to each user.
 *      When a page is cached here, the browser uses it without any network
 *      request at all — not even to Cloudflare.
 *
 * ─── s-maxage vs max-age ─────────────────────────────────────────────────────
 *
 * Both are standard HTTP Cache-Control directives in the same header:
 *
 *   Cache-Control: public, max-age=300, s-maxage=31536000, stale-while-revalidate=3600
 *
 *   - max-age=300       → browser caches for 5 minutes (ignores s-maxage)
 *   - s-maxage=31536000 → Cloudflare edge caches for 1 year (browsers ignore s-maxage)
 *   - stale-while-revalidate=3600 → after s-maxage expires, Cloudflare serves
 *                         stale content for 1 more hour while refreshing in background
 *
 * Cloudflare passes the full Cache-Control header downstream to the browser as-is.
 * The browser reads max-age, ignores s-maxage. The CDN reads s-maxage, uses it
 * to override max-age for edge TTL. This is confirmed Cloudflare behavior:
 * https://developers.cloudflare.com/cache/concepts/cache-control/
 *
 * ─── TAG-BASED PURGING ───────────────────────────────────────────────────────
 *
 * Each response is tagged via the Cache-Tag header (e.g. "work-hello, works").
 * When content changes in the CMS, the /api/cache/purge endpoint calls
 * Cloudflare's API to purge all responses with matching tags — instantly
 * evicting them from the edge cache regardless of s-maxage.
 *
 * After purge: next visitor triggers a fresh Worker render, new response
 * gets cached for another year. No staleness, no waiting.
 *
 * ─── WHY 5 MINUTES IN THE BROWSER ───────────────────────────────────────────
 *
 * Astro's ClientRouter (SPA-style navigation) uses <link rel="prefetch"> to
 * pre-download pages the user is likely to visit next. Prefetch stores the
 * response in the browser's HTTP disk cache.
 *
 * When the user actually clicks the link, the browser checks its cache:
 *   - If the response is still fresh (within max-age) → used instantly, no request
 *   - If max-age has expired → browser must revalidate with Cloudflare first
 *     (sends a conditional GET; Cloudflare returns 304 Not Modified if unchanged)
 *
 * Unlike <link rel="preload"> (which is for current-page resources and often
 * NOT reused for navigation), rel="prefetch" IS specifically designed for
 * next-page navigation. MDN confirms it uses the same Accept header as real
 * navigations, so the prefetched response CAN be reused when the user navigates.
 * Source: https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/rel/prefetch
 *
 * IMPORTANT: Cache-Control headers like no-cache or no-store block prefetch
 * reuse entirely. The browser stores the response but must revalidate before
 * using it, defeating the purpose of prefetching for instant navigation.
 *
 * With max-age=300: if the user clicks a prefetched link within 5 minutes,
 * navigation is instant (no network request). After 5 minutes, a round-trip
 * to Cloudflare is needed — but Cloudflare's edge cache makes this very fast.
 *
 * ─── BROWSER CACHE STALENESS WINDOW ─────────────────────────────────────────
 *
 * If content changes in the CMS:
 *   - Cloudflare edge cache is purged immediately via Cache-Tag
 *   - Browser cache is NOT purgeable remotely — users may see stale content
 *     for up to 5 minutes (the max-age window)
 *
 * For a creative studio portfolio that rarely changes, this is acceptable.
 * A hard refresh (Ctrl+Shift+R) bypasses browser cache if needed during editing.
 *
 * Timeline example with max-age=5, swr=30 (illustrative small values):
 *   t=0s   → prefetch happens, response stored fresh
 *   t=5s   → entry becomes stale (max-age expired)
 *   t=5-35s → within stale-while-revalidate window: browser MAY serve stale
 *             instantly + trigger background revalidation
 *   t=60s  → both max-age AND swr expired → browser MUST block and revalidate
 *             before using it (round-trip required, no instant navigation)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */
const factory: CacheProviderFactory = (_config) => {
  return {
    name: 'cloudflare-cdn',

    setHeaders(options) {
      const headers = new Headers()

      if (options.maxAge !== undefined) {
        // max-age   → browser caches for 5 minutes
        // s-maxage  → Cloudflare edge caches for the full duration (browsers ignore s-maxage)
        // stale-while-revalidate → Cloudflare serves stale while refreshing in background
        let value = `public, max-age=300, s-maxage=${options.maxAge}`
        if (options.swr !== undefined) {
          value += `, stale-while-revalidate=${options.swr}`
        }
        headers.set('Cache-Control', value)
      }

      if (options.tags?.length) {
        headers.set('Cache-Tag', options.tags.join(','))
      }

      if (options.lastModified) {
        headers.set('Last-Modified', options.lastModified.toUTCString())
      }

      return headers
    },

    async invalidate(_options) {
      // Tag/path invalidation requires the Cloudflare Cache Purge API.
      // This is handled by the /api/cache/purge endpoint in this project.
    },
  }
}

export default factory
