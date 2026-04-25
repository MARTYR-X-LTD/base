# cms — Payload CMS

## Dev Commands

```bash
cd cms/
pnpm dev          # Payload dev server
pnpm build        # Production build
docker compose up # Start PostgreSQL 18 locally
```

## Testing

Vitest + Testcontainers. Docker daemon must be running. No manual DB setup needed — a throwaway `postgres:18` container is spun up automatically per run.

```bash
pnpm test         # All tests (unit + integration + R2 pipeline)
pnpm test:unit    # Boot cleanup logic only (fast, no DB)
pnpm test:int     # Collection/access-control tests (needs Docker)
pnpm test:media   # Full AVIF pipeline + real R2 upload (needs Docker + R2 creds)
```

### Test structure

```
src/test/
  fixtures/          # Test assets (fragments-1.webp)
  unit/              # Pure unit tests, fully mocked
  integration/       # Real Payload + ephemeral Postgres
    access-control.test.ts
    media-processing.test.ts
  global-setup.ts    # Starts/stops Postgres container, loads .env
```

### R2 isolation

Tests upload to the `vitest/` prefix in R2 (`vitest/images/`, `vitest/videos/`), never touching `local/` or `prod/`. The prefix is purged before and after the media suite so crashed runs leave no orphans.

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

## Draft Preview

The `admin.preview` function on `Works` and `StoreProducts` signs a JWT using `PREVIEW_SECRET` (HMAC-SHA256, 24h expiry) and returns a URL pointing to the frontend's `/api/preview/enter`. Token signing lives in `src/lib/preview-token.ts`. Requires `FRONTEND_URL` in `.env`. See `docs/web/preview.md`.

## Editor Token

For pages requiring live edits (read-write from the frontend), use the HMAC signer in `src/lib/hmac-token.ts`. Same `PREVIEW_SECRET`, different payload shape (`{ role, doc, userId, exp }`). The token is stored in the frontend cookie for middleware re-verification. See `docs/web/editor-pattern.md`.

## Docs

- **Updating dependencies:** see `docs/updating/cms.md`
- **Docker workflow:** see `scripts/docker-entrypoint.sh`
- **Database cloning:** see `scripts/clone-prod-db.sh`
