# mönk Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the mönk creative studio portfolio as a monorepo with Astro 6.1 frontend (Cloudflare Workers) and Payload CMS backend (Docker/Coolify), carrying proven patterns from martyrio.

**Architecture:** Monorepo with independent `web/` and `cms/` projects (no pnpm workspaces). Frontend uses Astro 6.1 SSR with Live Content Collections fetching from Payload CMS REST API. Experimental route caching with cache-tag invalidation via a secured purge endpoint. CMS deployed via Docker to Coolify VPS, frontend deployed to Cloudflare Workers.

**Tech Stack:** Astro 6.1, Svelte 5, Bits-UI, SCSS, Payload CMS, PostgreSQL 18, Cloudflare Workers/R2, Docker, GitHub Actions, PNPM, TypeScript

**Spec:** `docs/superpowers/specs/2026-04-11-monk-bootstrap-design.md`

**Reference codebases:** `~/martyr/martyrio/web` (Astro 5 frontend), `~/martyr/martyrio/cms` (Payload CMS)

**Tooling:** Use Context7 MCP to fetch current docs before writing integration code. Use `/superpowers` skills as appropriate.

---

## Chunk 1: Monorepo Skeleton (Phase 1)

### Task 1: Initialize git repo and directory structure

**Files:**
- Create: `monk/` root git repo
- Create: directory tree for `web/`, `cms/`, `docs/`, `.github/workflows/`

- [ ] **Step 1: Initialize git repo**

```bash
cd /home/arecsu/o3/monk
git init
```

- [ ] **Step 2: Create directory structure**

```bash
# Web directories
mkdir -p web/src/{layouts,components/Lexical,styles,lib/loaders,pages/{work,store,api/{cache,preview}},types/cms}
mkdir -p web/public

# CMS directories
mkdir -p cms/src/{collections,blocks,fields/mediaGallery,plugins/{media-processor,svg-processor},lib/lexical,hooks}
mkdir -p cms/scripts
mkdir -p cms/docs

# Shared
mkdir -p docs/updating
mkdir -p .github/workflows
```

- [ ] **Step 3: Create .gitkeep files for empty directories that need to exist**

Only for directories that won't immediately get files in subsequent tasks. Skip — all directories will receive files in later tasks.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "[monk] Init: create monorepo directory structure"
```

---

### Task 2: Root CLAUDE.md

**Files:**
- Create: `CLAUDE.md`

- [ ] **Step 1: Write root CLAUDE.md**

This file is loaded every session. Keep it lean — essentials only, pointers to docs for depth.

```markdown
# mönk

Creative studio portfolio. Monorepo: `web/` (Astro 6.1 on Cloudflare Workers) + `cms/` (Payload CMS on Docker/Coolify).

## Git Workflow

Single `main` branch for now. Everything goes to main — local dev and Cloudflare unlisted URLs.

### Commit Style

`[scope] Area: description`

Scopes: `[web]`, `[cms]`, `[gh]`, `[docs]`, `[web/cms]`

- Area is capitalized, description is lowercase
- Be specific — name the thing that changed
- Avoid `feat:`, `fix:` prefixes — use specific area names
- `chore:` acceptable for housekeeping with no clear owner

Examples:
```
[web] SCSS: add color tokens
[cms] Works: add gallery block
[gh] CI: add CMS build workflow
[docs] Updating: add dependency guides
[web/cms] Cache: add purge endpoint and afterChange hooks
```

## Project Structure

- `web/` — Astro 6.1 frontend, SSR on Cloudflare Workers. See `web/CLAUDE.md`.
- `cms/` — Payload CMS, Docker deployed to Coolify VPS. See `cms/CLAUDE.md`.
- `docs/` — Shared project documentation.
  - `docs/updating/web.md` — Frontend dependency update guide.
  - `docs/updating/cms.md` — CMS dependency update guide.

## Tooling

- Use **Context7 MCP** to fetch current library docs before writing integration code.
- Use `/superpowers` skills: `subagent-driven-development`, `writing-plans`, `brainstorming`, `verification-before-completion`.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "[monk] CLAUDE.md: add root project guide"
```

---

### Task 3: web/CLAUDE.md

**Files:**
- Create: `web/CLAUDE.md`

- [ ] **Step 1: Write web/CLAUDE.md**

Adapt from `~/martyr/martyrio/web/CLAUDE.md`. Key differences: Astro 6.1 (not 5), SSR (not SSG), no Shopify, monorepo commit style, Cloudflare-first dev server.

```markdown
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

## Docs

- **Updating dependencies:** see `docs/updating/web.md`
```

- [ ] **Step 2: Commit**

```bash
git add web/CLAUDE.md
git commit -m "[web] CLAUDE.md: add frontend dev guide"
```

---

### Task 4: cms/CLAUDE.md

**Files:**
- Create: `cms/CLAUDE.md`

- [ ] **Step 1: Write cms/CLAUDE.md**

Adapt from `~/martyr/martyrio/cms/CLAUDE.md`. Key differences: monorepo, no Shopify, monk- prefixed containers.

```markdown
# cms — Payload CMS

## Dev Commands

```bash
cd cms/
pnpm dev          # Payload dev server
pnpm build        # Production build
docker compose up # Start PostgreSQL 18 locally
```

## Tech Stack

- **CMS:** Payload CMS with LexicalEditor
- **Database:** PostgreSQL 18
- **Storage:** Cloudflare R2 (images, video, SVG, 3D)
- **Media:** Custom media-processor (AVIF) + svg-processor plugins
- **Deployment:** Docker → GHCR → Coolify VPS (Germany)

## Critical Gotchas

### Always pass `req` to Local API

Inside hooks, always pass `req` to local API operations to avoid Postgres transaction deadlocks:
```typescript
// CORRECT
await payload.update({ collection: 'media', id, data, req })

// WRONG — can deadlock
await payload.update({ collection: 'media', id, data })
```

### Database Migrations

Migrations auto-run in production via `prodMigrations`. Before startup, `docker-entrypoint.sh` creates a backup of the DB (keeps 5). If a migration fails, a backup is available.

When adding/removing fields:
```bash
pnpm run migrate:create    # Generate migration
pnpm run migrate           # Apply migration
```

### Media URL Reconstruction

PayloadCMS overwrites R2 URLs with local paths. Use `customUrl` field + `afterRead` hook to restore the correct R2 URL.

### Access Control

- `admins` — full CRUD
- `api-key` — read-only (used by frontend)
- Always use `isAdmin` / `isAuthenticated` helpers from `src/lib/access-control.ts`

## Docs

- **Updating dependencies:** see `docs/updating/cms.md`
- **Docker workflow:** see `scripts/docker-entrypoint.sh`
- **Database cloning:** see `scripts/clone-prod-db.sh`
```

- [ ] **Step 2: Commit**

```bash
git add cms/CLAUDE.md
git commit -m "[cms] CLAUDE.md: add CMS dev guide"
```

---

### Task 5: Dependency update guides

**Files:**
- Create: `docs/updating/web.md`
- Create: `docs/updating/cms.md`

- [ ] **Step 1: Write docs/updating/web.md**

Adapt from `~/martyr/martyrio/web/docs/updating-dependencies.md`. Key changes: monorepo paths, Astro 6.1, wrangler.jsonc compatibility_date.

Read `~/martyr/martyrio/web/docs/updating-dependencies.md` first, then adapt:
- Replace any martyrio-specific references with monk
- Update Astro version references to 6.1
- Keep the `compatibility_date` update reminder for `wrangler.jsonc`
- Keep the general workflow: fetch changelogs (via Context7 MCP or context-mode), update deps, test, commit
- Reference `.node-version` for Node version management

- [ ] **Step 2: Write docs/updating/cms.md**

Adapt from `~/martyr/martyrio/cms/docs/updating-dependencies.md`. Key changes: monorepo paths, monk- prefixed containers.

Read `~/martyr/martyrio/cms/docs/updating-dependencies.md` first, then adapt:
- Replace martyrio-specific references with monk
- Keep the workflow: delete node_modules, `pnpm update`, clone prod DB, create/apply migrations, `pnpm approve-builds`, rebuild/verify
- Keep Docker image rebuild step
- Reference postgresql-client-18 (not 17)

- [ ] **Step 3: Commit**

```bash
git add docs/updating/
git commit -m "[docs] Updating: add dependency update guides for web and cms"
```

---

### Task 6: GitHub Actions workflow

**Files:**
- Create: `.github/workflows/cms-build.yml`

- [ ] **Step 1: Write cms-build.yml**

Adapt from `~/martyr/martyrio/cms/.github/workflows/build.yml`. Key changes:
- Trigger on `paths: ['cms/**']` instead of root
- Working directory set to `cms/` for all build steps
- Same structure: build Docker image, push to GHCR with `latest` + SHA tags, call Coolify webhook
- Triggers on `main` push or manual `workflow_dispatch`

Read `~/martyr/martyrio/cms/.github/workflows/build.yml` first, then adapt:
- Add `paths: ['cms/**']` to push trigger
- Add `defaults.run.working-directory: cms` or prefix commands with `cd cms/`
- Docker context should be `cms/` directory
- Keep GHCR push with `latest` + SHA tags
- Keep Coolify webhook call
- Keep job summary

- [ ] **Step 2: Commit**

```bash
git add .github/
git commit -m "[gh] CI: add CMS Docker build and deploy workflow"
```

---

### Task 7: Node version and .gitignore

**Files:**
- Create: `web/.node-version`
- Create: `cms/.node-version`
- Create: `.gitignore`

- [ ] **Step 1: Write .node-version files**

Both set to `24.14.0` (matching martyrio, fnm picks this up).

- [ ] **Step 2: Write root .gitignore**

```gitignore
# Dependencies
node_modules/

# Build output
web/dist/
cms/dist/
cms/build/

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Payload
cms/media/

# Astro
web/.astro/

# PNPM
.pnpm-debug.log

# Database backups (local)
cms/db-backups/
```

- [ ] **Step 3: Commit**

```bash
git add web/.node-version cms/.node-version .gitignore
git commit -m "[monk] Init: add node version and gitignore"
```

---

## Chunk 2: CMS Foundation (Phase 2a)

> **This chunk runs as a subagent, parallel with Chunk 3 (Frontend Foundation).**
> 
> **Reference codebase:** `~/martyr/martyrio/cms/`
> **Spec section:** "CMS Architecture" in the design spec
> 
> **Before writing any Payload code:** Use Context7 MCP to fetch current Payload CMS docs for collections, access control, Lexical editor config, blocks, hooks, and plugins.

### Task 8: CMS package.json and base config

**Files:**
- Create: `cms/package.json`
- Create: `cms/tsconfig.json`
- Create: `cms/.env.example`

- [ ] **Step 1: Research current Payload CMS setup**

Use Context7 MCP to fetch Payload CMS docs for:
- `payload.config.ts` structure
- `@payloadcms/db-postgres` setup
- `@payloadcms/richtext-lexical` setup
- Versions/drafts configuration

- [ ] **Step 2: Write cms/package.json**

Key dependencies (fetch latest versions via Context7 MCP or npm):
- `payload` (latest 3.x)
- `@payloadcms/db-postgres`
- `@payloadcms/richtext-lexical`
- `@payloadcms/storage-s3` (for R2)
- `sharp` (image processing)
- `nanoid` (ID generation)

Scripts:
```json
{
  "dev": "payload dev",
  "build": "payload build",
  "serve": "payload serve",
  "migrate": "payload migrate",
  "migrate:create": "payload migrate:create",
  "migrate:status": "payload migrate:status",
  "db:clone-prod": "./scripts/clone-prod-db.sh",
  "approve-builds": "pnpm approve-builds"
}
```

Set `"packageManager": "pnpm@latest"` and `"type": "module"`.

- [ ] **Step 3: Write cms/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "paths": {
      "@/*": ["./src/*"],
      "@payload-config": ["./payload.config.ts"]
    }
  },
  "include": ["src/**/*", "payload.config.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Write cms/.env.example**

```env
# Database
DATABASE_URI=postgres://postgres:postgres@localhost:5432/monk

# Payload
PAYLOAD_SECRET=your-secret-here

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=monk-media
R2_PUBLIC_URL=https://media.monk.dev
R2_PREFIX=

# Storage adapter (set to "local" for local development without R2)
STORAGE_ADAPTER=local

# Cache purge (must match web/.env PURGE_SECRET)
PURGE_SECRET=your-shared-purge-secret
FRONTEND_PURGE_URL=https://monk.dev/api/cache/purge

# Production (for clone-prod-db.sh)
PROD_SSH_HOST=
PROD_DATABASE_URI=
```

- [ ] **Step 5: Commit**

```bash
cd /home/arecsu/o3/monk
git add cms/package.json cms/tsconfig.json cms/.env.example
git commit -m "[cms] Init: add package.json, tsconfig, and env example"
```

---

### Task 9: Payload config and constants

**Files:**
- Create: `cms/payload.config.ts`
- Create: `cms/src/lib/constants.ts`

- [ ] **Step 1: Write cms/src/lib/constants.ts**

```typescript
export const SITE_NAME = 'mönk'
export const SITE_DESCRIPTION = 'mönk Creative Studio CMS'

export const MEDIA_TYPES = ['image', 'svg', 'video', '3d'] as const
export type MediaType = (typeof MEDIA_TYPES)[number]
```

- [ ] **Step 2: Write cms/payload.config.ts**

Adapt from `~/martyr/martyrio/cms/payload.config.ts`. Key changes:
- Import all monk collections (Works, StoreProducts, Categories, Media, Users, TagRegistry)
- Configure `@payloadcms/db-postgres` with `DATABASE_URI`
- Configure `@payloadcms/richtext-lexical` as default editor
- Enable `prodMigrations` for auto-migration in production
- No Shopify-related config
- No deploy queue

```typescript
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { fileURLToPath } from 'url'

import { Works } from './src/collections/Works'
import { StoreProducts } from './src/collections/StoreProducts'
import { Categories } from './src/collections/Categories'
import { Media } from './src/collections/Media'
import { Users } from './src/collections/Users'
import { TagRegistry } from './src/collections/TagRegistry'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
  },
  collections: [Works, StoreProducts, Categories, Media, Users, TagRegistry],
  editor: lexicalEditor(),
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URI },
    prodMigrations: [], // populated as migrations are created
  }),
  typescript: {
    outputFile: path.resolve(dirname, 'src/payload-types.ts'),
  },
  secret: process.env.PAYLOAD_SECRET || 'default-secret-change-me',
})
```

- [ ] **Step 3: Commit**

```bash
git add cms/payload.config.ts cms/src/lib/constants.ts
git commit -m "[cms] Config: add payload config and constants"
```

---

### Task 10: Access control

**Files:**
- Create: `cms/src/lib/access-control.ts`

- [ ] **Step 1: Write access control helpers**

Adapt from `~/martyr/martyrio/cms/src/lib/access-control.ts`. Add read-only API key role.

```typescript
import type { Access, FieldAccess } from 'payload'

export const isAdmin: Access = ({ req: { user } }) => {
  if (!user) return false
  return user.role === 'admin' || !user.role // backwards compat
}

export const isAuthenticated: Access = ({ req: { user } }) => {
  return Boolean(user)
}

// Collection-level access patterns
export const adminsOnly = {
  create: isAdmin,
  read: isAuthenticated,
  update: isAdmin,
  delete: isAdmin,
}

// readOnly is not needed — adminsOnly already grants read to all authenticated users
// The api-key role gets read access through isAuthenticated, and is blocked from
// create/update/delete by isAdmin. This is the correct pattern for read-only API keys.

// Field-level
export const adminFieldAccess: FieldAccess = ({ req: { user } }) => {
  if (!user) return false
  return user.role === 'admin' || !user.role
}
```

- [ ] **Step 2: Commit**

```bash
git add cms/src/lib/access-control.ts
git commit -m "[cms] Access: add access control helpers with read-only API key support"
```

---

### Task 11: Lexical editor configs

**Files:**
- Create: `cms/src/lib/lexical/full.ts`
- Create: `cms/src/lib/lexical/lite.ts`

- [ ] **Step 1: Research Payload Lexical editor config**

Use Context7 MCP to fetch Payload CMS Lexical editor docs — specifically how to enable/disable features, configure link feature with internal document relationships.

- [ ] **Step 2: Write full Lexical config**

```typescript
// cms/src/lib/lexical/full.ts
import { lexicalEditor } from '@payloadcms/richtext-lexical'

export const fullEditor = lexicalEditor()
```

- [ ] **Step 3: Write Lite Lexical config**

```typescript
// cms/src/lib/lexical/lite.ts
import {
  lexicalEditor,
  BoldFeature,
  ItalicFeature,
  LinkFeature,
} from '@payloadcms/richtext-lexical'

export const liteEditor = lexicalEditor({
  features: [
    BoldFeature(),
    ItalicFeature(),
    LinkFeature({
      enabledCollections: ['works', 'store-products'],
    }),
  ],
})
```

> **Note:** Verify exact import paths and LinkFeature config with internal doc relationships via Context7 MCP during implementation.

- [ ] **Step 4: Commit**

```bash
git add cms/src/lib/lexical/
git commit -m "[cms] Lexical: add full and lite editor configurations"
```

---

### Task 12: Users collection

**Files:**
- Create: `cms/src/collections/Users.ts`

- [ ] **Step 1: Write Users collection**

```typescript
import type { CollectionConfig } from 'payload'
import { isAdmin, isAuthenticated } from '../lib/access-control'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    useAPIKey: true,
  },
  admin: {
    useAsTitle: 'email',
  },
  access: {
    create: isAdmin,
    read: isAuthenticated,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'api-key',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'API Key (Read Only)', value: 'api-key' },
      ],
    },
  ],
}
```

- [ ] **Step 2: Commit**

```bash
git add cms/src/collections/Users.ts
git commit -m "[cms] Users: add collection with admin and read-only API key roles"
```

---

### Task 13: TagRegistry collection

**Files:**
- Create: `cms/src/collections/TagRegistry.ts`

- [ ] **Step 1: Write TagRegistry collection**

```typescript
import type { CollectionConfig } from 'payload'
import { adminsOnly } from '../lib/access-control'

export const TagRegistry: CollectionConfig = {
  slug: 'tag-registry',
  admin: {
    useAsTitle: 'label',
    defaultColumns: ['label'],
  },
  access: adminsOnly,
  fields: [
    {
      name: 'label',
      type: 'text',
      required: true,
      unique: true,
    },
  ],
}
```

- [ ] **Step 2: Commit**

```bash
git add cms/src/collections/TagRegistry.ts
git commit -m "[cms] TagRegistry: add global label collection for Smart-Tag system"
```

---

### Task 14: Categories collection

**Files:**
- Create: `cms/src/collections/Categories.ts`

- [ ] **Step 1: Write Categories collection**

```typescript
import type { CollectionConfig } from 'payload'
import { adminsOnly } from '../lib/access-control'
import { purgeCache } from '../hooks/purgeCache'

export const Categories: CollectionConfig = {
  slug: 'categories',
  admin: {
    useAsTitle: 'name',
  },
  access: adminsOnly,
  hooks: {
    afterChange: [purgeCache(['categories'])],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        position: 'sidebar',
      },
    },
  ],
}
```

> **Note:** Auto-generation of slug from name should use a `beforeValidate` hook or Payload's built-in slug field if available. Verify with Context7 MCP.

- [ ] **Step 2: Commit**

```bash
git add cms/src/collections/Categories.ts
git commit -m "[cms] Categories: add collection with cache purge hook"
```

---

### Task 15: Cache purge hook

**Files:**
- Create: `cms/src/hooks/purgeCache.ts`

- [ ] **Step 1: Write purge cache hook**

```typescript
import type { CollectionAfterChangeHook } from 'payload'

export const purgeCache = (
  tags: string[] | ((doc: any) => string[])
): CollectionAfterChangeHook => {
  return async ({ doc, req }) => {
    const purgeUrl = process.env.FRONTEND_PURGE_URL
    const purgeSecret = process.env.PURGE_SECRET

    if (!purgeUrl || !purgeSecret) {
      req.payload.logger.warn('Cache purge skipped: missing FRONTEND_PURGE_URL or PURGE_SECRET')
      return doc
    }

    const resolvedTags = typeof tags === 'function' ? tags(doc) : tags

    try {
      await fetch(purgeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${purgeSecret}`,
        },
        body: JSON.stringify({ tags: resolvedTags }),
      })
    } catch (error) {
      req.payload.logger.error(`Cache purge failed: ${error}`)
    }

    return doc
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add cms/src/hooks/purgeCache.ts
git commit -m "[cms] Hooks: add cache purge afterChange hook"
```

---

### Task 16: Blocks — SingleMedia, InfoItem, Table

**Files:**
- Create: `cms/src/blocks/SingleMedia.ts`
- Create: `cms/src/blocks/InfoItem.ts`
- Create: `cms/src/blocks/Table.ts`

- [ ] **Step 1: Research Payload blocks config**

Use Context7 MCP to fetch Payload CMS docs for blocks, especially the `Block` type and how to use richText fields with custom editor configs.

- [ ] **Step 2: Write SingleMedia block**

```typescript
import type { Block } from 'payload'

export const SingleMedia: Block = {
  slug: 'single-media',
  labels: {
    singular: 'Single Media',
    plural: 'Single Media',
  },
  fields: [
    {
      name: 'media',
      type: 'relationship',
      relationTo: 'media',
      required: true,
    },
  ],
}
```

- [ ] **Step 3: Write InfoItem block**

```typescript
import type { Block } from 'payload'
import { liteEditor } from '../lib/lexical/lite'

export const InfoItem: Block = {
  slug: 'info-item',
  labels: {
    singular: 'Info Item',
    plural: 'Info Items',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'content',
      type: 'richText',
      editor: liteEditor,
    },
    {
      name: 'displayMode',
      type: 'select',
      defaultValue: 'fixed',
      options: [
        { label: 'Fixed', value: 'fixed' },
        { label: 'Collapsible', value: 'collapsible' },
      ],
    },
    {
      name: 'openByDefault',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        condition: (_, siblingData) => siblingData?.displayMode === 'collapsible',
      },
    },
  ],
}
```

- [ ] **Step 4: Write Table block**

```typescript
import type { Block } from 'payload'
import { liteEditor } from '../lib/lexical/lite'

export const Table: Block = {
  slug: 'table',
  labels: {
    singular: 'Table',
    plural: 'Tables',
  },
  fields: [
    {
      name: 'rows',
      type: 'array',
      fields: [
        {
          name: 'label',
          type: 'text',
          required: true,
          // Smart-Tag: autocomplete from TagRegistry, freeform allowed
          // Custom component needed for autocomplete UI — implement during Phase 3 or later
        },
        {
          name: 'value',
          type: 'richText',
          editor: liteEditor,
        },
      ],
    },
  ],
}
```

> **Note:** The Smart-Tag autocomplete UI for the label field requires a custom admin component. This can be deferred to a later phase — the field works as plain text input initially.

- [ ] **Step 5: Commit**

```bash
git add cms/src/blocks/
git commit -m "[cms] Blocks: add SingleMedia, InfoItem, and Table blocks"
```

---

### Task 17: Media collection

**Files:**
- Create: `cms/src/collections/Media.ts`

- [ ] **Step 1: Write Media collection**

Adapt from `~/martyr/martyrio/cms/src/collections/Media.ts`. Key changes: add `mediaType` auto-detection, add video metadata, add 3D support, no filename uniqueness constraint.

```typescript
import type { CollectionConfig } from 'payload'
import { adminsOnly } from '../lib/access-control'

export const Media: CollectionConfig = {
  slug: 'media',
  upload: {
    staticDir: 'media',
    mimeTypes: [
      'image/*',
      'video/*',
      'image/svg+xml',
      'model/gltf-binary', // .glb
    ],
  },
  admin: {
    useAsTitle: 'filename',
  },
  access: adminsOnly,
  fields: [
    {
      name: 'alt',
      type: 'text',
    },
    {
      name: 'mediaType',
      type: 'select',
      options: [
        { label: 'Image', value: 'image' },
        { label: 'SVG', value: 'svg' },
        { label: 'Video', value: 'video' },
        { label: '3D', value: '3d' },
      ],
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'variants',
      type: 'array',
      admin: {
        readOnly: true,
        condition: (data) => data?.mediaType === 'image',
      },
      fields: [
        { name: 'url', type: 'text' },
        { name: 'width', type: 'number' },
        { name: 'height', type: 'number' },
        { name: 'size', type: 'number' },
      ],
    },
    {
      name: 'videoMetadata',
      type: 'group',
      admin: {
        condition: (data) => data?.mediaType === 'video',
      },
      fields: [
        { name: 'duration', type: 'number' },
        { name: 'width', type: 'number' },
        { name: 'height', type: 'number' },
      ],
    },
    {
      name: 'customUrl',
      type: 'text',
      admin: { readOnly: true },
    },
  ],
}
```

> **Note:** `mediaType` auto-detection will be set in a `beforeValidate` hook by checking the file's mimetype. The media-processor and svg-processor plugins handle the actual processing — they'll be added in a later task.

- [ ] **Step 2: Commit**

```bash
git add cms/src/collections/Media.ts
git commit -m "[cms] Media: add collection with auto-detected media types"
```

---

### Task 18: Works collection

**Files:**
- Create: `cms/src/collections/Works.ts`

- [ ] **Step 1: Write Works collection**

```typescript
import type { CollectionConfig } from 'payload'
import { adminsOnly } from '../lib/access-control'
import { purgeCache } from '../hooks/purgeCache'
import { SingleMedia } from '../blocks/SingleMedia'
import { InfoItem } from '../blocks/InfoItem'
import { Table } from '../blocks/Table'

export const Works: CollectionConfig = {
  slug: 'works',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'updatedAt'],
  },
  access: adminsOnly,
  versions: {
    drafts: true,
  },
  hooks: {
    afterChange: [
      purgeCache((doc) => [`work-${doc.slug}`, 'works']),
    ],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
    },
    {
      name: 'featuredImage',
      type: 'relationship',
      relationTo: 'media',
      filterOptions: {
        mediaType: { equals: 'image' },
      },
    },
    {
      name: 'gallery',
      type: 'blocks',
      blocks: [SingleMedia],
    },
    {
      name: 'infoPanel',
      type: 'blocks',
      blocks: [InfoItem, Table],
    },
  ],
}
```

- [ ] **Step 2: Commit**

```bash
git add cms/src/collections/Works.ts
git commit -m "[cms] Works: add collection with gallery, info panel, and cache purge"
```

---

### Task 19: StoreProducts collection

**Files:**
- Create: `cms/src/collections/StoreProducts.ts`

- [ ] **Step 1: Write StoreProducts collection**

Same as Works minus `category`. Different cache tags.

```typescript
import type { CollectionConfig } from 'payload'
import { adminsOnly } from '../lib/access-control'
import { purgeCache } from '../hooks/purgeCache'
import { SingleMedia } from '../blocks/SingleMedia'
import { InfoItem } from '../blocks/InfoItem'
import { Table } from '../blocks/Table'

export const StoreProducts: CollectionConfig = {
  slug: 'store-products',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'updatedAt'],
  },
  access: adminsOnly,
  versions: {
    drafts: true,
  },
  hooks: {
    afterChange: [
      purgeCache((doc) => [`product-${doc.slug}`, 'products']),
    ],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'featuredImage',
      type: 'relationship',
      relationTo: 'media',
      filterOptions: {
        mediaType: { equals: 'image' },
      },
    },
    {
      name: 'gallery',
      type: 'blocks',
      blocks: [SingleMedia],
    },
    {
      name: 'infoPanel',
      type: 'blocks',
      blocks: [InfoItem, Table],
    },
  ],
}
```

- [ ] **Step 2: Commit**

```bash
git add cms/src/collections/StoreProducts.ts
git commit -m "[cms] StoreProducts: add collection with gallery, info panel, and cache purge"
```

---

### Task 20: Storage and media plugins (skeleton)

**Files:**
- Create: `cms/src/lib/storage.ts`
- Create: `cms/src/plugins/media-processor/index.ts`
- Create: `cms/src/plugins/svg-processor/index.ts`

- [ ] **Step 1: Write storage config**

Adapt from `~/martyr/martyrio/cms/src/lib/storage.ts`. R2 config with local fallback.

```typescript
import { s3Storage } from '@payloadcms/storage-s3'

export function getStoragePlugin() {
  if (process.env.STORAGE_ADAPTER === 'local') {
    return undefined
  }

  return s3Storage({
    bucket: process.env.R2_BUCKET!,
    config: {
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
      region: 'auto',
    },
    // Media collection bypasses s3Storage — handled by media-processor + svg-processor
    // Future collections (3D models, documents) can be added here:
    // collections: { 'models': { prefix: 'models' } }
  })
}
```

- [ ] **Step 2: Write media-processor plugin skeleton**

```typescript
// cms/src/plugins/media-processor/index.ts
import type { Plugin } from 'payload'

/**
 * Media processor plugin — handles AVIF generation and R2 upload for image files.
 * Adapted from ~/martyr/martyrio/cms/src/plugins/media-processor/
 *
 * Full implementation requires:
 * - Sharp for image resizing
 * - avifenc for AVIF encoding
 * - R2 upload logic
 * - beforeChange hook on Media collection to process uploads
 * - afterRead hook to restore R2 URLs
 *
 * Adapt the full implementation from martyrio during detailed plugin work.
 */
export const mediaProcessor: Plugin = (config) => {
  // TODO: adapt from ~/martyr/martyrio/cms/src/plugins/media-processor/
  return config
}
```

- [ ] **Step 3: Write svg-processor plugin skeleton**

```typescript
// cms/src/plugins/svg-processor/index.ts
import type { Plugin } from 'payload'

/**
 * SVG processor plugin — handles SVG sanitization and R2 upload.
 * Adapted from ~/martyr/martyrio/cms/src/plugins/svg-processor/
 *
 * Full implementation requires:
 * - SVG sanitization (remove scripts, event handlers)
 * - Dimension extraction
 * - R2 upload
 * - afterRead hook to restore R2 URLs and clean irrelevant fields
 *
 * Adapt the full implementation from martyrio during detailed plugin work.
 */
export const svgProcessor: Plugin = (config) => {
  // TODO: adapt from ~/martyr/martyrio/cms/src/plugins/svg-processor/
  return config
}
```

> **Note:** Plugin full implementations are significant pieces of work. The skeletons register the plugins in payload.config.ts. Full adaptation from martyrio should be its own focused task/plan.

- [ ] **Step 4: Commit**

```bash
git add cms/src/lib/storage.ts cms/src/plugins/
git commit -m "[cms] Plugins: add storage config and media/svg processor skeletons"
```

---

### Task 21: Instrumentation

**Files:**
- Create: `cms/src/instrumentation.ts`

- [ ] **Step 1: Write instrumentation.ts**

Adapt from `~/martyr/martyrio/cms/src/instrumentation.ts`. Remove Shopify sync. Keep orphan cleanup and temp file cleanup.

```typescript
import type { Payload } from 'payload'

/**
 * Runs once on server boot (not per-request).
 * Handles cleanup tasks.
 */
export async function onInit(payload: Payload) {
  payload.logger.info('Running boot-time cleanup pipelines...')

  // 1. Orphaned media cleanup — scan /tmp for partial uploads
  try {
    await cleanupOrphanedMedia(payload)
  } catch (error) {
    payload.logger.error(`Orphaned media cleanup failed: ${error}`)
  }

  // 2. avifenc temp file cleanup
  try {
    await cleanupTempFiles()
  } catch (error) {
    payload.logger.error(`Temp file cleanup failed: ${error}`)
  }

  payload.logger.info('Boot-time cleanup complete.')
}

async function cleanupOrphanedMedia(payload: Payload) {
  // TODO: adapt from ~/martyr/martyrio/cms/src/instrumentation.ts
  // Scan /tmp/ for partial upload files, check if Media doc exists, delete orphans from R2
}

async function cleanupTempFiles() {
  // TODO: adapt from ~/martyr/martyrio/cms/src/instrumentation.ts
  // Remove *.png, *.avif with UUID patterns from /tmp/
}
```

- [ ] **Step 2: Commit**

```bash
git add cms/src/instrumentation.ts
git commit -m "[cms] Instrumentation: add boot-time cleanup pipelines"
```

---

### Task 22: Docker setup

**Files:**
- Create: `cms/Dockerfile`
- Create: `cms/docker-compose.yml`
- Create: `cms/scripts/docker-entrypoint.sh`
- Create: `cms/scripts/clone-prod-db.sh`

- [ ] **Step 1: Write docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:18
    container_name: monk-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: monk
    ports:
      - "5432:5432"
    volumes:
      - monk-pg-data:/var/lib/postgresql/data

volumes:
  monk-pg-data:
```

- [ ] **Step 2: Write docker-entrypoint.sh**

Adapt from `~/martyr/martyrio/cms/scripts/docker-entrypoint.sh`. Same logic: wait for DB, backup before migrate, keep 5 backups, run migrations, start server.

Read `~/martyr/martyrio/cms/scripts/docker-entrypoint.sh`, then adapt:
- Change container/app references from martyrio to monk
- Update postgresql-client version to 18
- Keep the backup rotation logic (5 backups)
- Keep the migration auto-run

- [ ] **Step 3: Write Dockerfile**

Adapt from `~/martyr/martyrio/cms/Dockerfile`. Multi-stage: libavif builder → deps → build → runner.

Read `~/martyr/martyrio/cms/Dockerfile`, then adapt:
- Change `postgresql-client-17` to `postgresql-client-18`
- Keep libavif builder stage (HEAD git clone)
- Keep Node 24 slim base
- Keep ffmpeg inclusion
- Keep health check
- Update COPY paths for monorepo context (Docker context will be `cms/`)

- [ ] **Step 4: Write clone-prod-db.sh**

Adapt from `~/martyr/martyrio/cms/scripts/clone-prod-db.sh`:
- Change database name from martyrio to monk
- Keep SSH tunnel logic
- Keep dump/restore workflow

- [ ] **Step 5: Make scripts executable and commit**

```bash
chmod +x cms/scripts/docker-entrypoint.sh cms/scripts/clone-prod-db.sh
git add cms/Dockerfile cms/docker-compose.yml cms/scripts/
git commit -m "[cms] Docker: add Dockerfile, compose, entrypoint, and clone-prod-db scripts"
```

---

## Chunk 3: Frontend Foundation (Phase 2b)

> **This chunk runs as a subagent, parallel with Chunk 2 (CMS Foundation).**
> 
> **Reference codebase:** `~/martyr/martyrio/web/`
> **Spec section:** "Frontend Architecture" in the design spec
> 
> **Before writing Astro 6.1 code:** Use Context7 MCP to fetch current Astro 6.1 docs for config, Cloudflare adapter, Live Content Collections, route caching, Fonts API.

### Task 23: Frontend package.json and base config

**Files:**
- Create: `web/package.json`
- Create: `web/tsconfig.json`
- Create: `web/.env.example`

- [ ] **Step 1: Research Astro 6.1 project setup**

Use Context7 MCP to fetch:
- Astro 6.1 `astro.config.ts` structure
- `@astrojs/cloudflare` adapter config for Astro 6
- `@astrojs/svelte` integration
- Experimental route caching config
- Fonts API config

- [ ] **Step 2: Write web/package.json**

Key dependencies (fetch latest versions):
- `astro` (6.1.x)
- `@astrojs/cloudflare`
- `@astrojs/svelte`
- `svelte`
- `bits-ui`
- `astro-seo`
- `swiper`
- `three` (placeholder)
- `unplugin-icons`

Dev dependencies:
- `sass` (SCSS support)
- `typescript`

Scripts:
```json
{
  "dev": "astro dev",
  "build": "astro build",
  "preview": "astro preview",
  "astro": "astro"
}
```

Set `"packageManager": "pnpm@latest"` and `"type": "module"`.

- [ ] **Step 3: Write web/tsconfig.json**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@cms/*": ["../cms/src/*"]
    }
  }
}
```

- [ ] **Step 4: Write web/.env.example**

```env
# Payload CMS
CMS_API_URL=http://localhost:3000/api
CMS_API_KEY=your-read-only-api-key

# Cache purge
PURGE_SECRET=your-shared-purge-secret

# Preview
PREVIEW_SECRET=your-preview-secret
```

- [ ] **Step 5: Commit**

```bash
cd /home/arecsu/o3/monk
git add web/package.json web/tsconfig.json web/.env.example
git commit -m "[web] Init: add package.json, tsconfig, and env example"
```

---

### Task 24: Astro config and wrangler

**Files:**
- Create: `web/astro.config.ts`
- Create: `web/wrangler.jsonc`

- [ ] **Step 1: Write astro.config.ts**

```typescript
import { defineConfig } from 'astro/config'
import cloudflare from '@astrojs/cloudflare'
import svelte from '@astrojs/svelte'
import Icons from 'unplugin-icons/vite'

export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  integrations: [svelte()],
  experimental: {
    cache: {
      // Cloudflare cache provider — verify exact config with Context7 MCP
      // provider: cloudflareCache() or similar
    },
  },
  vite: {
    plugins: [
      Icons({
        compiler: 'svelte',
        autoInstall: true,
      }),
    ],
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `@use "src/styles/_vars" as *;`,
        },
      },
    },
  },
})
```

> **Note:** Route caching provider config needs verification with Astro 6.1 + Cloudflare docs via Context7 MCP. The Fonts API config should also be added here once confirmed.

- [ ] **Step 2: Write wrangler.jsonc**

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "monk-web",
  "main": "@astrojs/cloudflare/entrypoints/server",
  "compatibility_date": "2026-04-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": "./dist"
  },
  "observability": {
    "enabled": true
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add web/astro.config.ts web/wrangler.jsonc
git commit -m "[web] Config: add Astro 6.1 config and wrangler.jsonc"
```

---

### Task 25: SCSS system

**Files:**
- Create: `web/src/styles/_layers.scss`
- Create: `web/src/styles/_reset.scss`
- Create: `web/src/styles/_colors.scss`
- Create: `web/src/styles/_base.scss`
- Create: `web/src/styles/_mixins.scss`
- Create: `web/src/styles/_vars.scss`
- Create: `web/src/styles/utilities.scss`

- [ ] **Step 1: Write _layers.scss**

Copy from `~/martyr/martyrio/web/src/styles/_layers.scss`:
```scss
@layer reset, colors, base, components, components-override, utilities, a11y;
```

- [ ] **Step 2: Write _reset.scss**

Copy as-is from `~/martyr/martyrio/web/src/styles/_reset.scss`. No changes needed.

- [ ] **Step 3: Write _colors.scss**

Simplified from martyrio — static dark theme:
```scss
@layer colors {
  :root {
    // Surface
    --color-surface: #0a0a0a;
    --color-surface-raised: #141414;
    --color-surface-overlay: #1a1a1a;

    // Text
    --color-text: #e8e8e8;
    --color-text-muted: #888888;
    --color-text-subtle: #555555;

    // Accent — TBD by designer, placeholder
    --color-accent: #ffffff;
    --color-accent-muted: #cccccc;

    // Borders
    --color-border: #2a2a2a;
    --color-border-subtle: #1e1e1e;

    // Interactive
    --color-interactive: var(--color-accent);
    --color-interactive-hover: var(--color-text);
  }
}
```

> **Note:** These are placeholder values. The actual color tokens will be defined by the designer (Ahmad). Structure follows the same semantic naming as martyrio but drastically simplified.

- [ ] **Step 4: Write _mixins.scss**

Adapt from `~/martyr/martyrio/web/src/styles/_mixins.scss`:
- Keep `hover` and `coarse` device queries
- Adapt typography mixins from Inter to Roboto
- Keep any utility mixins used by Icon.svelte

Read `~/martyr/martyrio/web/src/styles/_mixins.scss` first, then adapt.

- [ ] **Step 5: Write _vars.scss**

This file is injected globally via `additionalData`. It should only contain variables/mixins that need to be available in every SCSS file without explicit import.

```scss
// Injected globally via astro.config.ts additionalData
// Only put @use/@forward statements and variables needed everywhere

@forward "mixins";
```

> **Note:** Verify the exact `additionalData` pattern from martyrio's astro.config.ts and adapt.

- [ ] **Step 6: Write _base.scss**

Adapt from `~/martyr/martyrio/web/src/styles/base.scss`:
- Change font references from Inter to Roboto
- Keep global element styles (body, a, h1-h6, etc.)
- Apply dark theme colors

- [ ] **Step 7: Write utilities.scss**

Start minimal — add utilities as needed:
```scss
@layer utilities {
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }

  .visually-hidden {
    @extend .sr-only;
  }
}
```

- [ ] **Step 8: Commit**

```bash
git add web/src/styles/
git commit -m "[web] SCSS: add layer system, reset, colors, mixins, base, and utilities"
```

---

### Task 26: Base.astro layout

**Files:**
- Create: `web/src/layouts/Base.astro`

- [ ] **Step 1: Write Base.astro**

Adapt from `~/martyr/martyrio/web/src/layouts/Base.astro`. Key changes: Astro 6.1 imports, Roboto font, no Shopify data, route caching integration placeholder.

```astro
---
import { ClientRouter } from 'astro:transitions'
import { SEO } from 'astro-seo'

// SCSS imports — order matters for @layer cascade
import '../styles/_layers.scss'
import '../styles/_reset.scss'
import '../styles/_colors.scss'
import '../styles/_base.scss'
import '../styles/utilities.scss'

interface Props {
  title: string
  description?: string
  image?: string
  noindex?: boolean
}

const { title, description, image, noindex = false } = Astro.props
const canonicalURL = new URL(Astro.url.pathname, Astro.site)
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <SEO
      title={title}
      description={description}
      canonical={canonicalURL.href}
      openGraph={{
        basic: {
          title,
          type: 'website',
          image: image ?? '',
        },
      }}
      noindex={noindex}
    />
    <ClientRouter fallback="swap" />
  </head>
  <body>
    <slot />
  </body>
</html>
```

> **Note:** Astro Fonts API integration for Roboto to be added here once the exact API is confirmed via Context7 MCP.

- [ ] **Step 2: Commit**

```bash
git add web/src/layouts/Base.astro
git commit -m "[web] Base: add layout with SCSS cascade, SEO, and ClientRouter"
```

---

### Task 27: Static asset caching headers

**Files:**
- Create: `web/public/_headers`

- [ ] **Step 1: Write _headers**

Adapt from `~/martyr/martyrio/web/public/_headers`:

```
# Versioned assets — immutable
/_astro/*
  Cache-Control: public, max-age=31536000, immutable

# Static images
/*.png
  Cache-Control: public, max-age=604800, immutable
/*.svg
  Cache-Control: public, max-age=604800, immutable
/*.ico
  Cache-Control: public, max-age=604800, immutable

# Staging — prevent indexing
https://:project.pages.dev/*
  X-Robots-Tag: noindex
```

- [ ] **Step 2: Commit**

```bash
git add web/public/_headers
git commit -m "[web] Cache: add static asset caching headers"
```

---

### Task 28: Core components — Icon.svelte

**Files:**
- Create: `web/src/components/Icon.svelte`

- [ ] **Step 1: Write Icon.svelte**

Adapt from `~/martyr/martyrio/web/src/components/Icon.svelte`. This is the CSS var wrapper for unplugin-icons SVGs.

Read `~/martyr/martyrio/web/src/components/Icon.svelte`, then adapt:
- Keep the CSS variable pattern (`--i-s--size`, `--i-s--width`, `--i-s--color`)
- Keep the mixin dependencies
- No changes needed for the core component — it's framework-agnostic

- [ ] **Step 2: Commit**

```bash
git add web/src/components/Icon.svelte
git commit -m "[web] Icon: add SVG icon wrapper component"
```

---

### Task 29: Core components — Button.svelte

**Files:**
- Create: `web/src/components/Button.svelte`

- [ ] **Step 1: Write Button.svelte**

Adapt from `~/martyr/martyrio/web/src/components/Button.svelte`. Key changes: strip martyrio-specific variants, keep bits-ui foundation and ripple effect only.

Read `~/martyr/martyrio/web/src/components/Button.svelte`, then adapt:
- Keep bits-ui `Button.Root` wrapper pattern
- Keep ripple effect on click
- Keep Svelte 5 `$derived` reactivity patterns
- Remove martyrio-specific variants — start with a minimal set: `default`, `ghost`, `outline`
- Keep hover/coarse device handling from mixins

- [ ] **Step 2: Commit**

```bash
git add web/src/components/Button.svelte
git commit -m "[web] Button: add bits-ui foundation component"
```

---

### Task 30: Core components — MediaCarousel.svelte + Slide.svelte

**Files:**
- Create: `web/src/components/MediaCarousel.svelte`
- Create: `web/src/components/Slide.svelte`

- [ ] **Step 1: Write MediaCarousel.svelte**

Adapt from `~/martyr/martyrio/web/src/components/MediaCarousel.svelte`:
- Keep Swiper.js integration
- Keep custom pagination window logic
- Keep preloading nearby slides
- Modify Slide to handle image, video, and 3D content (based on media type)

Read the martyrio version first, then adapt.

- [ ] **Step 2: Write Slide.svelte**

Adapt from `~/martyr/martyrio/web/src/components/Slide.svelte`:
- Add conditional rendering based on media type (image/video/3D)
- Image: `<img>` with AVIF srcset
- Video: `<video>` element
- 3D: placeholder `<canvas>` for Three.js (will be fleshed out later)

- [ ] **Step 3: Commit**

```bash
git add web/src/components/MediaCarousel.svelte web/src/components/Slide.svelte
git commit -m "[web] Carousel: add MediaCarousel and Slide components"
```

---

### Task 31: Lexical renderer components

**Files:**
- Create: `web/src/components/Lexical/` (multiple files)

- [ ] **Step 1: Copy and adapt Lexical renderer from martyrio**

Read `~/martyr/martyrio/web/src/components/Lexical/` directory — identify all files. Copy them to `web/src/components/Lexical/`, adapting:
- Import paths
- Any martyrio-specific component references
- Internal link rendering (resolve Payload document references to frontend URLs)

> **Note:** The Lexical renderer is a set of components that deserialize Payload's Lexical JSON into HTML/Svelte components. This is a direct carry from martyrio — the format is the same since both use `@payloadcms/richtext-lexical`.

- [ ] **Step 2: Commit**

```bash
git add web/src/components/Lexical/
git commit -m "[web] Lexical: add rich text renderer components"
```

---

### Task 32: SEO setup and 404 page

**Files:**
- Create: `web/src/pages/404.astro`
- Create: `web/src/pages/index.astro` (placeholder)

- [ ] **Step 1: Write 404 page**

```astro
---
import Base from '../layouts/Base.astro'
---

<Base title="Page Not Found — mönk">
  <main>
    <h1>404</h1>
    <p>Page not found.</p>
    <a href="/">Back to home</a>
  </main>
</Base>
```

- [ ] **Step 2: Write index.astro placeholder**

```astro
---
import Base from '../layouts/Base.astro'
---

<Base title="mönk — Creative Studio">
  <main>
    <h1>mönk</h1>
    <p>Creative studio portfolio. Under construction.</p>
  </main>
</Base>
```

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/
git commit -m "[web] Pages: add 404 and index placeholder"
```

---

## Chunk 4: Integration (Phase 3)

> **This chunk runs after Chunks 2 and 3 are complete.**
> 
> **Before writing integration code:** Use Context7 MCP to fetch:
> - Astro 6.1 Live Content Collections API (`defineLiveCollection`, `getLiveCollection`, `getLiveEntry`)
> - Astro 6.1 experimental route caching API (`Astro.cache.set`, `context.cache.invalidate`)
> - Payload CMS REST API query syntax
> - Payload Preview API configuration

### Task 33: Custom Payload Live Collections loader

**Files:**
- Create: `web/src/lib/loaders/payload.ts`

- [ ] **Step 1: Research Live Content Collections loader API**

Use Context7 MCP to fetch Astro 6.1 docs for:
- `defineLiveCollection()` loader interface
- What a loader must return (entries, cacheHint)
- `getLiveCollection()` and `getLiveEntry()` usage

- [ ] **Step 2: Write custom Payload loader**

```typescript
// web/src/lib/loaders/payload.ts

interface PayloadLoaderOptions {
  collection: string
  apiUrl: string
  apiKey: string
  cacheTags: (doc: any) => string[]
  collectionTag: string
}

export function payloadLoader(options: PayloadLoaderOptions) {
  // Return a loader compatible with defineLiveCollection()
  // The exact interface depends on Astro 6.1's loader API — verify with Context7 MCP
  
  return {
    async load({ cookies }: { cookies: any }) {
      const isDraft = cookies.get('draft')?.value === 'true'
      
      const params = new URLSearchParams({
        depth: '2',
        limit: '100',
        ...(isDraft && { draft: 'true' }),
      })
      
      const response = await fetch(
        `${options.apiUrl}/${options.collection}?${params}`,
        {
          headers: {
            Authorization: `users API-Key ${options.apiKey}`,
          },
        },
      )
      
      const data = await response.json()
      
      return {
        entries: data.docs.map((doc: any) => ({
          id: doc.id,
          slug: doc.slug,
          data: doc,
        })),
        cacheHint: {
          tags: [
            options.collectionTag,
            ...data.docs.flatMap((doc: any) => options.cacheTags(doc)),
          ],
          lastModified: new Date(
            Math.max(...data.docs.map((d: any) => new Date(d.updatedAt).getTime())),
          ),
        },
      }
    },
  }
}
```

> **Note:** This is a best-guess implementation. The exact loader interface MUST be verified against Astro 6.1 docs via Context7 MCP before implementation. The authentication header format for Payload API key also needs verification.

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/loaders/payload.ts
git commit -m "[web] Loader: add custom Payload CMS Live Collections loader"
```

---

### Task 34: Live Content Collections config

**Files:**
- Create: `web/src/live.config.ts` (or project root — verify location)

- [ ] **Step 1: Verify live.config.ts location**

Use Context7 MCP to confirm where `live.config.ts` should live in Astro 6.1.

- [ ] **Step 2: Write live.config.ts**

```typescript
import { defineLiveCollection } from 'astro:content'
import { z } from 'astro/zod'
import { payloadLoader } from './lib/loaders/payload'

const API_URL = import.meta.env.CMS_API_URL
const API_KEY = import.meta.env.CMS_API_KEY

const works = defineLiveCollection({
  loader: payloadLoader({
    collection: 'works',
    apiUrl: API_URL,
    apiKey: API_KEY,
    cacheTags: (doc) => [`work-${doc.slug}`],
    collectionTag: 'works',
  }),
  schema: z.object({
    slug: z.string(),
    title: z.string(),
    category: z.any().optional(),
    featuredImage: z.any().optional(),
    gallery: z.array(z.any()).optional(),
    infoPanel: z.array(z.any()).optional(),
  }),
})

const storeProducts = defineLiveCollection({
  loader: payloadLoader({
    collection: 'store-products',
    apiUrl: API_URL,
    apiKey: API_KEY,
    cacheTags: (doc) => [`product-${doc.slug}`],
    collectionTag: 'products',
  }),
  schema: z.object({
    slug: z.string(),
    title: z.string(),
    featuredImage: z.any().optional(),
    gallery: z.array(z.any()).optional(),
    infoPanel: z.array(z.any()).optional(),
  }),
})

const categories = defineLiveCollection({
  loader: payloadLoader({
    collection: 'categories',
    apiUrl: API_URL,
    apiKey: API_KEY,
    cacheTags: (doc) => [`category-${doc.slug}`],
    collectionTag: 'categories',
  }),
  schema: z.object({
    slug: z.string(),
    name: z.string(),
  }),
})

export const collections = { works, storeProducts, categories }
```

- [ ] **Step 3: Commit**

```bash
git add web/src/live.config.ts  # or root path if different
git commit -m "[web] Collections: add Live Content Collections config for Payload CMS"
```

---

### Task 35: Cache purge API route

**Files:**
- Create: `web/src/pages/api/cache/purge.ts`

- [ ] **Step 1: Write cache purge endpoint**

```typescript
import type { APIRoute } from 'astro'

export const POST: APIRoute = async (context) => {
  const authHeader = context.request.headers.get('Authorization')
  const expected = `Bearer ${import.meta.env.PURGE_SECRET}`

  if (!authHeader || authHeader !== expected) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const body = await context.request.json()
  const { tags } = body

  if (!tags || !Array.isArray(tags)) {
    return new Response(JSON.stringify({ error: 'Invalid body: tags array required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    await context.cache.invalidate({ tags })
    return new Response(JSON.stringify({ purged: true, tags }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalidation failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
```

> **Note:** `context.cache.invalidate()` is from Astro's experimental route caching API. Verify the exact API with Context7 MCP.

- [ ] **Step 2: Commit**

```bash
git add web/src/pages/api/cache/purge.ts
git commit -m "[web] Cache: add secured purge API endpoint"
```

---

### Task 36: Draft preview API routes

**Files:**
- Create: `web/src/pages/api/preview/enter.ts`
- Create: `web/src/pages/api/preview/exit.ts`

- [ ] **Step 1: Research Payload Preview configuration**

Use Context7 MCP to fetch Payload CMS docs for:
- Preview URL configuration per collection
- How Payload sends the preview request (URL params, etc.)

- [ ] **Step 2: Write preview enter endpoint**

```typescript
import type { APIRoute } from 'astro'

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const secret = url.searchParams.get('secret')
  const slug = url.searchParams.get('slug')
  const collection = url.searchParams.get('collection')

  if (secret !== import.meta.env.PREVIEW_SECRET) {
    return new Response('Invalid preview secret', { status: 401 })
  }

  if (!slug || !collection) {
    return new Response('Missing slug or collection', { status: 400 })
  }

  // Set draft cookie
  cookies.set('draft', 'true', {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60, // 1 hour
  })

  // Redirect to the content page
  const redirectMap: Record<string, string> = {
    works: `/work/${slug}`,
    'store-products': `/store/${slug}`,
  }

  const targetPath = redirectMap[collection] ?? '/'
  return redirect(targetPath, 307)
}
```

- [ ] **Step 3: Write preview exit endpoint**

```typescript
import type { APIRoute } from 'astro'

export const GET: APIRoute = async ({ cookies, redirect }) => {
  cookies.delete('draft', { path: '/' })
  return redirect('/', 307)
}
```

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/api/preview/
git commit -m "[web] Preview: add draft preview enter/exit API routes"
```

---

## Chunk 5: Content Pages (Phase 4)

> **This chunk runs after Chunk 4 (Integration) is complete.**

### Task 37: Work listing page

**Files:**
- Create: `web/src/pages/work/index.astro`

- [ ] **Step 1: Write work listing page**

```astro
---
import { getLiveCollection } from 'astro:content'
import Base from '../../layouts/Base.astro'

export const prerender = false

const { entries: works, cacheHint } = await getLiveCollection('works')

if (cacheHint) {
  Astro.cache.set({ ...cacheHint, maxAge: 600, swr: 60 })
} else {
  Astro.cache.set({ maxAge: 600, swr: 60 })
}
---

<Base title="Work — mönk" description="Selected work from mönk creative studio">
  <main>
    <h1>Work</h1>
    <div class="work-grid">
      {works.map((work) => (
        <a href={`/work/${work.data.slug}`}>
          <h2>{work.data.title}</h2>
        </a>
      ))}
    </div>
  </main>
</Base>
```

> **Note:** This is a structural placeholder. Visual design (grid layout, cards, featured images) will be implemented when the designer provides specifications.

- [ ] **Step 2: Commit**

```bash
git add web/src/pages/work/index.astro
git commit -m "[web] Work: add listing page with Live Collections"
```

---

### Task 38: Work detail page

**Files:**
- Create: `web/src/pages/work/[slug].astro`

- [ ] **Step 1: Write work detail page**

```astro
---
import { getLiveEntry } from 'astro:content'
import Base from '../../layouts/Base.astro'
// import MediaCarousel from '../../components/MediaCarousel.svelte'
// import Lexical renderer when ready

export const prerender = false

const { slug } = Astro.params
const { entry: work, error, cacheHint } = await getLiveEntry('works', slug!)

if (error || !work) {
  return Astro.redirect('/404')
}

if (cacheHint) {
  Astro.cache.set({ ...cacheHint, maxAge: 600, swr: 60 })
} else {
  Astro.cache.set({ maxAge: 600, swr: 60 })
}

const { title, category, featuredImage, gallery, infoPanel } = work.data
---

<Base title={`${title} — mönk`}>
  <main>
    <article>
      <h1>{title}</h1>
      {category && <span class="category">{category.name}</span>}

      {/* Gallery placeholder — wire up MediaCarousel when component is ready */}
      {gallery && gallery.length > 0 && (
        <section class="gallery">
          <p>Gallery: {gallery.length} items</p>
        </section>
      )}

      {/* Info Panel placeholder */}
      {infoPanel && infoPanel.length > 0 && (
        <aside class="info-panel">
          {infoPanel.map((block: any) => (
            <div class={`block-${block.blockType}`}>
              {block.blockType === 'info-item' && (
                <div>
                  <h3>{block.title}</h3>
                  {/* Lexical render block.content */}
                </div>
              )}
              {block.blockType === 'table' && (
                <dl>
                  {block.rows?.map((row: any) => (
                    <>
                      <dt>{row.label}</dt>
                      <dd>{/* Lexical render row.value */}</dd>
                    </>
                  ))}
                </dl>
              )}
            </div>
          ))}
        </aside>
      )}
    </article>
  </main>
</Base>
```

- [ ] **Step 2: Commit**

```bash
git add web/src/pages/work/
git commit -m "[web] Work: add detail page with gallery and info panel placeholders"
```

---

### Task 39: Store listing and detail pages

**Files:**
- Create: `web/src/pages/store/index.astro`
- Create: `web/src/pages/store/[slug].astro`

- [ ] **Step 1: Write store listing page**

Same pattern as work listing but using `storeProducts` collection.

- [ ] **Step 2: Write store detail page**

Same pattern as work detail but without category. Different cache tags.

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/store/
git commit -m "[web] Store: add listing and detail pages"
```

---

### Task 40: Final — verify structure and cleanup

- [ ] **Step 1: Verify all files exist**

Run `find . -type f | sort` from project root. Compare against the spec's file tree.

- [ ] **Step 2: Verify git status is clean**

```bash
git status
```

- [ ] **Step 3: Tag the bootstrap milestone**

```bash
git tag -a v0.1.0 -m "Bootstrap: monorepo skeleton, CMS foundation, frontend foundation, integration, content pages"
```

---

## Dependency Graph

```
Task 1 (git init + dirs) → Task 2-7 (CLAUDE.md, docs, GH Action, gitignore)
                         ↓
              ┌──────────┴──────────┐
              ▼                     ▼
     Chunk 2 (CMS)          Chunk 3 (Frontend)
     Tasks 8-22              Tasks 23-32
              │                     │
              └──────────┬──────────┘
                         ▼
                  Chunk 4 (Integration)
                  Tasks 33-36
                         │
                         ▼
                  Chunk 5 (Content Pages)
                  Tasks 37-40
```

Chunks 2 and 3 run in **parallel as subagents**. Chunk 4 waits for both. Chunk 5 waits for Chunk 4.
