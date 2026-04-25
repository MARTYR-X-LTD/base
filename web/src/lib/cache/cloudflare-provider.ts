import type { CacheProviderFactory } from 'astro'

/**
 * Cloudflare CDN cache provider for Astro SSR.
 *
 * This provider implements two-layer caching: browser (max-age) + Cloudflare edge (s-maxage).
 * See `docs/web/cache-optimization.md` for comprehensive documentation including:
 *   - How the cache layers work (edge vs browser)
 *   - s-maxage vs max-age directives
 *   - Tag-based purging strategy
 *   - Why 5 minutes in the browser cache
 *   - Browser cache staleness window
 *
 * Quick reference:
 *   - Browser cache: max-age=300 (5 minutes per user)
 *   - Edge cache: s-maxage=31536000 (1 year, shared)
 *   - Cache invalidation: tag-based purging via /api/cache/purge
 *   - Prefetch compatibility: Astro ClientRouter uses rel="prefetch" for SPA navigation
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
