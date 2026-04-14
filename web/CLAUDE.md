# web — Astro 6.1 Frontend

## Dev Commands

```bash
cd web/
pnpm dev          # Astro dev server (runs workerd runtime locally)
pnpm build        # Production build
pnpm preview      # Preview production build locally
```

## Tech Stack

- **Framework:** Astro 6.1 with SSR on Cloudflare Workers
- **UI:** Svelte 5 + Bits-UI (headless components)
- **Styling:** SCSS with CSS @layer cascade
- **Icons:** unplugin-icons with autoInstall (import any icon set, auto-installs as dev dep)
- **Fonts:** Astro Fonts API (Roboto + TBD)
- **SEO:** astro-seo
- **Carousel:** Swiper.js
- **Caching:** Astro experimental route caching + Cloudflare CDN cache-tag invalidation
- **Content:** Live Content Collections with custom Payload CMS loader

## Key Patterns

### SCSS Import Order (Base.astro)

Order matters — layers must come first for proper CSS cascade:
1. `_layers.scss` — defines @layer order
2. `_reset.scss` — CSS reset
3. `_colors.scss` — semantic color tokens
4. `_base.scss` — global element styles
5. `utilities.scss` — utility classes

`_vars.scss` is injected globally via `additionalData` in astro.config.ts.
`_mixins.scss` is imported where needed (components, base).

### Svelte 5

- Never reference `$props()` in top-level assignments — use `$derived` for reactivity
- Use `onMount` for store subscriptions with cleanup

### CMS Types

Imported directly from CMS via TS path alias:
```typescript
import type { Work } from '@cms/payload-types'
```

### Draft Preview

`/api/preview/enter` validates a signed JWT (`?token=<jwt>`), sets a `draft=true` cookie, and redirects to the content page. The JWT is signed by the CMS using `PREVIEW_SECRET` (HMAC-SHA256, 24h expiry). Token verification lives in `src/utils/preview-token.ts`. See `docs/web/preview.md` for the full picture.

### TypeScript Path Aliases

Defined in `tsconfig.json`:
- `@/*` → `src/*`
- `@cms/*` → `../cms/src/*` (CMS types, including `payload-types.ts`)

### Wrangler

Cloudflare Workers config lives in `wrangler.jsonc`. Update `compatibility_date` when Cloudflare requires it. Env vars and secrets are managed via the Cloudflare dashboard (not wrangler CLI).

### Fonts

Astro Fonts API is in the stack but not yet configured. Planned: Roboto + designer TBD.

## Docs

- **Updating dependencies:** see `docs/updating/web.md`
