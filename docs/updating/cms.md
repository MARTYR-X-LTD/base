# Updating CMS Dependencies

## Workflow

1. Fetch changelogs for major dependencies (Payload CMS, PostgreSQL adapter, etc.) via the `find-docs` skill
2. In `cms/`:
   ```bash
   rm -rf node_modules
   pnpm update
   pnpm approve-builds
   ```
3. Clone production database to test migrations:
   ```bash
   pnpm run db:clone-prod
   ```
4. Create and apply migrations:
   ```bash
   pnpm run migrate:create  # if schema changed
   pnpm run migrate
   pnpm run migrate:status  # verify
   ```
5. Test:
   - `pnpm dev` — verify CMS starts
   - Verify collections load in admin
   - Test media upload pipeline
6. Rebuild Docker image locally if needed
7. Commit with `[cms] Deps: update <package> to vX.Y.Z`

## Key Dependencies to Watch

- **payload** — breaking changes in collections, hooks, editor config
- **@payloadcms/db-postgres** — migration compatibility
- **@payloadcms/richtext-lexical** — editor feature changes
- **@aws-sdk/client-s3** — R2 integration (via custom media-processor/svg-processor plugins; `@payloadcms/storage-s3` is not used)
- **sharp** — image processing compatibility

## PostgreSQL

Using PostgreSQL 18. Container name is auto-generated from `docker-compose.yml` (service name `postgres`).

## Docker

After dependency updates, rebuild and push Docker image:
```bash
docker build -t monk-cms:latest cms/
```

Coolify auto-deploys on push to `main` via GitHub Actions.
