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

## Bits-ui First

**Before writing any interactive UI element** — in Svelte OR Astro — check if bits-ui provides a headless foundation for it. bits-ui has 40+ components (accordion, select, combobox, radio group, switch, toggle, dialog, popover, tooltip, dropdown menu, tabs, etc.) that solve accessibility, keyboard navigation, and state management that raw HTML or a quick custom element would miss.

### Discovery

Fetch the full component index:

```
webfetch https://bits-ui.com/llms.txt
```

This returns every component, utility, and type helper with direct `/llms.txt` URLs.

### Fetching a component's API

Once identified, fetch the full page in one shot:

```
webfetch https://bits-ui.com/docs/components/{component}/llms.txt
```

One fetch gives you the complete API surface — all props, data attributes, CSS variables, examples, snippets. This is **more thorough than multiple ctx7 queries** and lets you discover capabilities you didn't know to search for (e.g., `forceMount`, `data-starting-style`, CSS variable hooks).

### Decision tree

1. **bits-ui has it?** → Fetch `/llms.txt` → wrap with our conventions in `src/components/ui/` (see `docs/web/frontend-guidelines.md`)
2. **bits-ui doesn't have it?** → Check martyrio (`~/martyr/martyrio/web/`) → port and adapt
3. **Neither?** → Build from scratch following the patterns in `docs/web/frontend-guidelines.md`

## Frontend Guidelines

**Before writing Svelte/SCSS, read `docs/web/frontend-guidelines.md`.** It covers the conventions we've learned the hard way — `$effect` as last resort, bits-ui `child` snippet pattern, when `:global()` is acceptable, token naming, martyrio porting. Ignoring these leads to rework.

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

**Before writing, editing, or reviewing any `.svelte` file or `.svelte.ts`/`.svelte.js` module, you MUST load the `svelte-code-writer` and `svelte-core-bestpractices` skills.** These provide access to the Svelte MCP tools (`svelte-autofixer`, `list-sections`, `get-documentation`) and authoritative best-practice guidance. The autofixer in particular catches runes mistakes, state reactivity issues, and style violations that are easy to miss. Do not rely on training-data memory for Svelte 5 APIs — they have moved.

Use runes everywhere. Be allergic to `$effect()` — if you think you need it, find a `$derived` approach instead.

- `const { x, y } = $props()` — destructure props
- `let count = $state(0)` — reactive state
- `const doubled = $derived(count * 2)` — simple derivation
- `const result = $derived.by(() => { ... })` — multi-step derivation (preferred over `$effect` for any computed value)
- Mutate Sets/Maps immutably: `poppedIds = new Set([...poppedIds, id])` — mutating in place doesn't trigger reactivity
- `onMount` is acceptable only for imperative browser APIs (ResizeObserver, IntersectionObserver, timers) that genuinely need lifecycle hooks
- Reference project for bits-ui and Svelte 5 patterns: `~/martyr/martyrio/web/`
- For Svelte 5 / SvelteKit APIs beyond what the skills cover, use the Svelte MCP tools (`list-sections`, `get-documentation`) via the loaded skills. For bits-ui, fetch /llms.txt pages via webfetch — see Bits-ui First section above.

### TypeScript Path Aliases

Defined in `tsconfig.json`:
- `@/*` → `src/*`
- `@cms/*` → `../cms/src/*` (CMS types, including `payload-types.ts`)

### CMS Types & Live Collections

`@cms/payload-types` is only imported in one place: `src/live.config.ts`. Everything else imports from `@/live.config`.

The reason: Payload-generated types include `number` for unpopulated relationships (`featuredImage: number | Media | null`). The loader fetches at `depth: 2` so relationships are always populated — but the types don't know that. `live.config.ts` is the boundary where this is resolved. The loader's `Populated<T>` utility strips `number` from relationship unions, and `LiveData<typeof collection>` derives the correct narrow type automatically from each collection definition.

```typescript
// src/live.config.ts — the only file that touches @cms/payload-types
import type { Work } from '@cms/payload-types'
const works = defineLiveCollection({ loader: payloadLoader<Work>({...}) })
export type Work = LiveData<typeof works>  // Populated<Work> — number stripped

// everywhere else
import type { Work } from '@/live.config'  // correct, narrow type
```

The principle generalises: **narrow external types at the data boundary, not at every usage site.** When an external source gives you pessimistic types, fix them once at the entry point so downstream code works cleanly.

**Gotcha:** `payload-types.ts` includes `declare module 'payload'` at the bottom. Since the `payload` package doesn't exist in `web/`, svelte-check errors. The fix is `web/src/types/payload-module.d.ts` — a one-line stub (`declare module 'payload' {}`). Never delete it.

**Gotcha:** Do not add Zod schemas to `defineLiveCollection` when using `payloadLoader<T>` — the loader generic already provides typing. Schemas would duplicate Payload types and drift out of sync.

**Gotcha:** Never use `z.any()` in schemas or `any` in type annotations. If the shape is unknown, use `unknown` and narrow explicitly, or derive the type from the source (Payload types, Zod inference, `ReturnType<>`, `typeof`). `any` silently breaks type inference downstream.

### Draft Preview

`/api/preview/enter` validates a signed JWT (`?token=<jwt>`), sets a `draft=true` cookie, and redirects to the content page. The JWT is signed by the CMS using `PREVIEW_SECRET` (HMAC-SHA256, 24h expiry). Token verification lives in `src/utils/preview-token.ts`. See `docs/web/preview.md` for the full picture.

**Important:** Astro live loaders only receive `{ filter, collection }` in their context — request cookies are **not** available. The page reads `Astro.cookies.get('draft')` and passes `draft: true` through the loader's filter object instead:
```typescript
const isDraft = Astro.cookies.get('draft')?.value === 'true'
const { entry } = await getLiveEntry('works', { id: slug!, draft: isDraft })
```
See `web/src/lib/loaders/payload.ts` for the `PayloadEntryFilter` / `PayloadCollectionFilter` types.

### Wrangler

Cloudflare Workers config lives in `wrangler.jsonc`. Update `compatibility_date` when Cloudflare requires it. Env vars and secrets are managed via the Cloudflare dashboard (not wrangler CLI).

### Editor Pattern

For frontend pages that need live edits with write-back to Payload, see `docs/web/editor-pattern.md`. The pattern uses:
- `src/utils/hmac-token.ts` — HMAC JWT verification (paired with `cms/src/lib/hmac-token.ts`)
- `src/middleware.ts` — re-verifies editor cookie on every request
- `/api/editor/enter` and `/api/editor/exit` — session management
- `/api/editor/save` — auth-gated write proxy (CMS_API_KEY never reaches the browser)

Draft preview (`/api/preview/enter`) and editor mode use the same `PREVIEW_SECRET` but different cookie strategies. See the doc for comparison.

### Fonts

Astro Fonts API is in the stack but not yet configured. Planned: Roboto + designer TBD.

## Docs

- **Updating dependencies:** see `docs/updating/web.md`
