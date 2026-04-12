# mönk — Project Bootstrap Design Spec

## Overview

mönk is a creative studio portfolio for Alejandro (Creative Engineer), Ahmad (Brand Designer), and Madina (UI/UX Designer). The site features a dark theme, carefully crafted details, and elegant composable code. It is built on patterns established in the `martyrio` project (`~/martyr/martyrio/web` and `~/martyr/martyrio/cms`), adapted for a simpler architecture with no Shopify integration, SSR instead of SSG, and modern Astro 6 features.

## Tech Stack

- **Frontend:** Astro 6.1, Svelte 5, Bits-UI, SCSS, Three.js, Swiper.js, astro-seo, unplugin-icons
- **Backend:** Payload CMS, PostgreSQL 18, Cloudflare R2 for media
- **Infrastructure:** Cloudflare Workers (frontend), Coolify VPS Germany (CMS Docker), GitHub Actions CI/CD
- **Tooling:** PNPM (no workspaces), TypeScript throughout, fnm for Node version management

## Monorepo Structure

Single git repo, no pnpm workspaces. Each project has its own `package.json` and `pnpm-lock.yaml`.

```
monk/
├── .github/
│   └── workflows/
│       └── cms-build.yml           # triggers on paths: ['cms/**']
├── web/
│   ├── package.json
│   ├── pnpm-lock.yaml
│   ├── .node-version               # Node 24 LTS (fnm)
│   ├── wrangler.jsonc
│   ├── astro.config.ts
│   ├── src/
│   │   ├── live.config.ts          # Live Content Collections definitions
│   │   ├── layouts/
│   │   │   └── Base.astro
│   │   ├── components/
│   │   │   ├── Button.svelte
│   │   │   ├── Icon.svelte
│   │   │   ├── MediaCarousel.svelte
│   │   │   ├── Slide.svelte
│   │   │   └── Lexical/
│   │   ├── styles/
│   │   │   ├── _layers.scss
│   │   │   ├── _reset.scss
│   │   │   ├── _colors.scss
│   │   │   ├── _base.scss
│   │   │   ├── _mixins.scss
│   │   │   ├── _vars.scss
│   │   │   └── utilities.scss
│   │   ├── lib/
│   │   │   └── loaders/
│   │   ├── pages/
│   │   │   ├── work/
│   │   │   ├── store/
│   │   │   └── api/
│   │   │       ├── cache/purge.ts
│   │   │       └── preview/
│   │   └── types/
│   │       └── cms/                # TS path alias @cms/* → ../cms/src/*
│   ├── public/
│   │   └── _headers
│   └── CLAUDE.md
├── cms/
│   ├── package.json
│   ├── pnpm-lock.yaml
│   ├── .node-version
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── payload.config.ts
│   ├── src/
│   │   ├── collections/
│   │   │   ├── Works.ts
│   │   │   ├── StoreProducts.ts
│   │   │   ├── Categories.ts
│   │   │   ├── Media.ts
│   │   │   ├── Users.ts
│   │   │   └── TagRegistry.ts
│   │   ├── blocks/
│   │   │   ├── SingleMedia.ts
│   │   │   ├── InfoItem.ts
│   │   │   └── Table.ts
│   │   ├── fields/
│   │   │   └── mediaGallery/
│   │   ├── plugins/
│   │   │   ├── media-processor/
│   │   │   └── svg-processor/
│   │   ├── lib/
│   │   │   ├── access-control.ts
│   │   │   ├── storage.ts
│   │   │   ├── constants.ts
│   │   │   └── lexical/
│   │   ├── hooks/
│   │   │   └── purgeCache.ts
│   │   └── instrumentation.ts
│   ├── scripts/
│   │   ├── docker-entrypoint.sh
│   │   └── clone-prod-db.sh
│   ├── docs/
│   │   └── updating-dependencies.md
│   └── CLAUDE.md
├── docs/
│   └── updating/
│       ├── web.md
│       └── cms.md
├── CLAUDE.md                       # root — points to web/ and cms/ CLAUDE.md files
└── README.md
```

### Cloudflare Monorepo Setup

- Frontend: Connect monorepo to Cloudflare Workers dashboard, set root directory to `web/`, configure build watch path to `web/**`. Cloudflare builds and deploys from `web/` independently.
- CMS: GitHub Action triggers on `paths: ['cms/**']`, builds Docker image, pushes to GHCR, calls Coolify webhook. Cloudflare never touches this directory.
- No pnpm workspaces needed — projects have completely different dependency trees and runtimes.

### Type Sync

Frontend imports Payload types directly via TypeScript path alias:
```typescript
// tsconfig.json paths
"@cms/*": ["../cms/src/*"]

// usage
import type { Work } from '@cms/payload-types'
```

## Frontend Architecture

### Astro 6.1 Config

- `@astrojs/cloudflare` adapter — runs `workerd` runtime in dev, prerendering, and production
- `@astrojs/svelte` integration (Svelte 5)
- `unplugin-icons/vite` with `autoInstall: true`, compiler `"svelte"` — no icon family packages pre-installed, auto-detects and installs on import
- Astro Fonts API for Roboto + TBD second font
- Experimental route caching enabled with Cloudflare cache provider
- SCSS `additionalData` injecting `_vars.scss` globally
- `output: "server"` (full SSR)
- `wrangler.jsonc`: `"main": "@astrojs/cloudflare/entrypoints/server"`

### SCSS System

Simplified from martyrio — static dark theme, no dynamic color picker.

- `_layers.scss` — `@layer reset, colors, base, components, components-override, utilities, a11y;`
- `_reset.scss` — carried as-is from martyrio
- `_colors.scss` — simple semantic tokens (`--color-surface`, `--color-text`, `--color-accent`, etc.). No shade generation functions.
- `_base.scss` — global HTML tag styles, adapted for Roboto
- `_mixins.scss` — `hover`/`coarse` device queries, typography mixins for Roboto
- `_vars.scss` — CSS custom properties, injected via `additionalData`
- `utilities.scss` — utility classes as needed

**Import order in Base.astro matters** — layers → reset → colors → base → utilities. This ensures proper CSS cascade via `@layer`.

### Base.astro Layout

- SCSS imports in correct cascade order
- `ClientRouter` with `fallback="swap"` for SPA-like page transitions
- `astro-seo` component (same pattern as martyrio/web)
- Astro Fonts API integration

### Core Components

Carried from martyrio/web:

- **Button.svelte** — Bits-UI foundation, clean slate for mönk-specific button variants. Includes hover/touch device handling via mixins.
- **Icon.svelte** — SVG wrapper using CSS vars and mixins for sizing/color. Works with unplugin-icons auto-install.
- **MediaCarousel.svelte + Slide.svelte** — Swiper.js integration, same structure and features as martyrio.
- **Lexical/** — Renderer components for displaying Lexical rich text content on frontend (carried from martyrio/web).

### SEO

Same patterns as martyrio/web using `astro-seo`.

### Static Asset Caching (`public/_headers`)

- `/_astro/*` — `max-age=31536000, immutable` (versioned JS/CSS/assets)
- Font files — long-lived immutable cache
- HTML pages — controlled by route caching API, not `_headers`

## Live Content Collections

Defined in `src/live.config.ts` using `defineLiveCollection()`.

### Collections

- **works** — fetches from Payload REST API `/api/works`. Cache tags: `work-{slug}`, `works`
- **storeProducts** — fetches `/api/store-products`. Cache tags: `product-{slug}`, `products`
- **categories** — fetches `/api/categories`. Cache tag: `categories`

### Custom Payload Loader

A custom loader that:
1. Authenticates with Payload REST API using read-only API key
2. Fetches collection entries or single entries by slug (via query params like `where[slug][equals]=...`)
3. Handles pagination, depth, and field filtering
4. Returns entries with `cacheHint: { tags, lastModified }`
5. Supports `draft=true` param when draft preview cookie is present

> **Note:** Confirm exact `live.config.ts` location for Astro 6.1 during implementation — may be project root or `src/`.

## Route Caching

Uses Astro 6's experimental route caching API with Cloudflare as first-class target.

### Per-route flow

1. Page calls `getLiveCollection()`/`getLiveEntry()` → receives `cacheHint`
2. Route calls `Astro.cache.set(cacheHint)` — optionally merged with additional options like `maxAge`, `swr`
3. Cloudflare cache provider translates to `CDN-Cache-Control` + `Cache-Tag` headers
4. Response cached at Cloudflare CDN

### Cache Invalidation

**Endpoint:** `POST /api/cache/purge`

- Secured with shared secret (`Authorization: Bearer <PURGE_SECRET>`)
- Body: `{ tags: ["work-pslab", "works"] }`
- Calls `context.cache.invalidate({ tags })`
- Cloudflare purges tagged responses across all PoPs

### Smart Tiered Cache

Cloudflare Smart Tiered Cache enabled at the zone level (dashboard config). Maximizes cache hit ratios — upper-tier PoPs serve as shared cache for regional PoPs. Cache-tag purge propagates through all tiers.

## Draft Preview System

### Flow

1. Editor clicks "Preview" in Payload admin on a draft document
2. Payload generates URL: `https://monk.dev/api/preview/enter?secret=PREVIEW_SECRET&slug={slug}&collection={collection}`
3. Astro API route validates secret, sets `draft=true` cookie, redirects to the document's frontend URL
4. Page request → loader sees draft cookie → adds `draft=true` to Payload REST call → receives unpublished version
5. Response served without CDN caching (`private`/`no-store`)
6. Editor navigates to `/api/preview/exit` → clears cookie → returns to normal browsing

> **Note:** Detailed research needed during implementation for: exact Payload Preview API configuration, draft cookie mechanics on Astro's side, and interaction with Cloudflare caching.

## CMS Architecture

### Payload Config

- `@payloadcms/richtext-lexical` for rich text
- `@payloadcms/db-postgres` with PostgreSQL 18
- Versions + Drafts enabled on Works and StoreProducts collections
- Preview feature configured per collection — generates URL to frontend's preview endpoint

### Collections

#### Works
- `title` (string, required)
- `slug` (string, unique, auto-generated from title)
- `category` (relationship → Categories) — singular for now, TBD if multiple
- `featuredImage` (relationship → Media, filtered to images)
- `gallery` (blocks field — reorderable SingleMedia blocks, thumbnail previews in admin UI)
- `infoPanel` (blocks field — InfoItem and Table blocks, reorderable)
- Versions + Drafts enabled
- Preview configured
- `afterChange` hook → purge cache tags `["work-{slug}", "works"]`

#### StoreProducts
- Same structure as Works minus `category`
- `afterChange` hook → purge tags `["product-{slug}", "products"]`

#### Categories
- `name` (string, required)
- `slug` (string, unique, auto-generated)
- `afterChange` hook → purge tag `["categories"]`

#### Media
- Auto-detect type from mimetype at upload:
  - Image → media-processor (AVIF variant generation) → R2
  - SVG → svg-processor (sanitization) → R2
  - Video → extract metadata (duration, dimensions) → R2
  - 3D (`.glb`) → direct R2 upload
- `mediaType` (auto-set: `image` | `svg` | `video` | `3d`)
- `variants` array (AVIF sizes, for images)
- `videoMetadata` group (for videos)
- R2 storage for all types

#### Users
- `role`: `admin` | `api-key`
- `admin` — full CRUD on all collections
- `api-key` — read-only on all collections (used by frontend)
- Access control: `isAdmin`, `isAuthenticated` helpers

#### TagRegistry
- `label` (string, unique, required) — e.g., "Client", "Year", "Role", "Technology"
- Used by Table Block's Smart-Tag label field for autocomplete suggestions
- Freeform input also allowed — registry provides suggestions, not constraints

### Blocks

#### SingleMedia
- `media` (relationship → Media) — no type filter, type auto-detected
- Same display options as martyrio's Single Image block

#### InfoItem
- `title` (string)
- `content` (Lite Lexical — bold, italic, links with internal document references)
- `displayMode` (select: `fixed` | `collapsible`)
- `openByDefault` (checkbox, conditional on `displayMode === 'collapsible'`)

#### Table
- `rows` (array):
  - `label` — Smart-Tag Hybrid: text input with autocomplete from TagRegistry, freeform allowed
  - `value` (Lite Lexical — bold, italic, links with internal document references)

### Lexical Configs

- **Full** — default Lexical features, for future long-form content needs
- **Lite** — bold, italic, link feature only (with internal document relationship support for links)

### Plugins

- **media-processor** — adapted from martyrio. AVIF generation via avifenc/Sharp, R2 upload, variant management.
- **svg-processor** — adapted from martyrio. SVG sanitization (remove scripts/event handlers), R2 upload, dimension extraction.

### Infrastructure

- **Dockerfile** — multi-stage: libavif builder → Node 24 slim → app runner. Includes ffmpeg, postgresql-client-18, avifenc/avifdec.
- **docker-compose.yml** — `postgres:18` service with persistent volume. Container names use `monk-` prefix.
- **docker-entrypoint.sh** — wait for DB, create pre-startup backup (keep 5), run migrations, start server.
- **clone-prod-db.sh** — SSH to production VPS, dump database, restore locally for testing migrations.
- **instrumentation.ts** — orphaned media cleanup (scan `/tmp/` for partial uploads), avifenc temp file cleanup. No Shopify sync.
- **GitHub Action** — trigger on `cms/**` push to main, build Docker image, push to GHCR with `latest` + SHA tags, call Coolify webhook.
- **.env.example** — DATABASE_URI, PAYLOAD_SECRET, R2 credentials, PURGE_SECRET, FRONTEND_PURGE_URL, PROD_SSH_HOST, PROD_DATABASE_URI.

> **Note:** `PURGE_SECRET` must be the same value in both `web/.env` and `cms/.env`. `FRONTEND_PURGE_URL` in `cms/.env` points to the frontend's purge endpoint.

### Access Control

```
admins → full CRUD on all collections
api-key (read-only) → read on all collections, no create/update/delete
```

Frontend authenticates with the read-only API key user to fetch content from Payload REST API.

### Cache Purge Hook

`afterChange` hooks on Works, StoreProducts, and Categories POST to the frontend's `/api/cache/purge` endpoint with relevant tags and the shared `PURGE_SECRET`.

## Content Pages

### /work (listing)
- Fetches all works via `getLiveCollection('works')`
- Grid layout (specifics TBD by designer)
- Cache tags: `["works"]`

### /work/[slug] (detail)
- Fetches single work via `getLiveEntry('works', slug)`
- Layout: featured image, gallery (MediaCarousel), info panel (InfoItem + Table blocks), Lexical content
- Cache tags: `["work-{slug}", "works", "categories"]` (includes `categories` because category name is displayed on the detail page)

### /store (listing)
- Fetches all products via `getLiveCollection('storeProducts')`
- Grid layout (specifics TBD)
- Cache tags: `["products"]`

### /store/[slug] (detail)
- Same layout pattern as work detail
- Cache tags: `["product-{slug}", "products"]`

### Error / 404 Handling
- Custom 404 page for invalid slugs — `getLiveEntry` returning no result redirects or renders 404
- Astro's built-in `src/pages/404.astro` for unmatched routes

### Overview & Archive
- Content TBD. Placeholder routes.

### Three.js
- Placeholder setup. Will be expanded as project matures.

## Implementation Strategy

**Approach:** Parallel scaffold (Approach C), **subagent-driven development**.

### Phase 1 — Monorepo Skeleton
- Git init, directory structure
- Root CLAUDE.md, web/CLAUDE.md, cms/CLAUDE.md
- `docs/updating/web.md` and `docs/updating/cms.md` (adapted from martyrio)
- `.github/workflows/cms-build.yml`

### Phase 2a — CMS Foundation (subagent)
- Payload config with Postgres 18, Lexical, drafts/versions
- All collections: Works, StoreProducts, Categories, Media, Users, TagRegistry
- Blocks: SingleMedia, InfoItem, Table (with Smart-Tag)
- Lexical configs: Full + Lite
- media-processor + svg-processor plugins (adapted from martyrio)
- Access control: admin (full CRUD), api-key (read-only)
- instrumentation.ts (cleanup pipelines)
- Docker setup (Dockerfile, docker-compose.yml, entrypoint)
- Scripts (clone-prod-db.sh)
- Preview URL generation config
- afterChange hooks for cache purge
- .env.example

### Phase 2b — Frontend Foundation (subagent, parallel with 2a)
- Astro 6.1 config: Cloudflare adapter, Svelte 5, unplugin-icons, Fonts API (Roboto), experimental route caching
- wrangler.jsonc with new entrypoint
- SCSS system: layers, reset, colors (dark theme), base, mixins, vars, utilities
- Base.astro: correct SCSS import order, ClientRouter, astro-seo, Fonts
- Core components: Button.svelte (bits-ui foundation), Icon.svelte, MediaCarousel.svelte, Slide.svelte
- Lexical renderer components (from martyrio/web)
- SEO setup (from martyrio/web)
- _headers for static asset caching
- TS path alias @cms/* → ../cms/src/*
- .env.example

### Phase 3 — Integration (after 2a + 2b)
- Custom Payload Live Content Collections loader in src/live.config.ts
- Route caching wired up per page
- Cache purge API route (/api/cache/purge.ts)
- Draft preview system (/api/preview/enter.ts, /api/preview/exit.ts)
- Loader draft-awareness (cookie check)

### Phase 4 — Content Pages
- /work listing and /work/[slug] detail pages
- /store listing and /store/[slug] detail pages
- Gallery rendering, info panel, Lexical content display
- Three.js placeholder setup

## Tooling Guidance

- Use `/superpowers` skills throughout implementation: `subagent-driven-development` for Phase 2a/2b parallelism, `writing-plans` for detailed step-by-step plans, `brainstorming` for sub-decisions, `verification-before-completion` before claiming done.
- Use **Context7 MCP** to fetch current docs for Payload CMS, Astro 6, Cloudflare Workers, bits-ui, swiper.js, and any other library before writing integration code.
- Research specifics during implementation: Payload Preview API, draft mode cookie mechanics, Cloudflare cache-tag purge behavior, route caching provider API.

## Key Patterns from Martyrio to Preserve

- SCSS layer architecture and import order
- Button.svelte bits-ui pattern (foundation only, new variants for mönk)
- Icon.svelte with mixin dependencies
- MediaCarousel.svelte + Slide.svelte (swiper.js)
- Lexical frontend renderer
- SEO setup (astro-seo)
- media-processor and svg-processor plugins
- Access control patterns
- Docker multi-stage build
- Database backup and clone scripts
- instrumentation.ts cleanup pipelines
- Gallery block UI with thumbnail previews and drag/sort in admin

## Key Patterns from Martyrio to Skip

- Shopify integration (GraphQL, sync, deploy queues)
- Global data maps (replaced by Live Content Collections per-route fetching)
- SSG build (replaced by SSR on Cloudflare Workers)
- Dynamic color picker system (replaced by static dark theme)
- oxlint/oxfmt (skipped for simplicity)
- Comparison Pair and Filterable Collection gallery blocks

## Git Workflow

- **Single `main` branch** during early development — all local dev and Cloudflare unlisted URLs. No `dev` branch yet.
- Once the site is public/production, revisit strategy: likely `dev` branch for active work, `main` for live production.
- Commit style: `[scope] Area: description`. Scopes: `[web]`, `[cms]`, `[gh]`, `[docs]`, `[web/cms]` (cross-cutting, both sides in one commit). Examples: `[web] SCSS: add color tokens`, `[cms] Works: add gallery block`, `[gh] CI: add CMS build workflow`, `[docs] Updating: add dependency guides`, `[web/cms] Cache: add purge endpoint and afterChange hooks`. Avoid `feat:`, `fix:` prefixes — use specific component/area names.
- Cloudflare auto-deploys frontend on push to main (scoped to `web/`)
- GitHub Action auto-deploys CMS on push to main (scoped to `cms/`)

## CLAUDE.md Strategy

Root and per-project CLAUDE.md files should contain **only what's needed every session**:
- Commit style and git workflow
- Core dev commands (`pnpm dev`, `pnpm build`, etc.)
- Critical gotchas (e.g., always pass `req` in Payload hooks)
- Pointer to `docs/` for deeper reference

Detailed guides (updating dependencies, media pipeline internals, Cloudflare caching details, Docker workflow) live in `docs/` — CLAUDE.md points to them so LLMs know where to look when they need it.
