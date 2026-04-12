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
