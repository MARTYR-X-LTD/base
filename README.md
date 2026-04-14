# mönk

Creative studio portfolio. Monorepo: `web/` (Astro + Cloudflare Workers) and `cms/` (Payload CMS on Docker).

## Getting started

```bash
./init.sh
```

This copies `.env.example` → `.env` (if not already present) and symlinks it into `cms/` and `web/`. Fill in your values before running any dev servers.

## Dev

```bash
# CMS (Postgres + Payload, via zellij)
cd cms && pnpm dev

# Frontend
cd web && pnpm dev

# Frontend against production CMS
cd web && pnpm dev:prod-cms   # requires web/.env.prod-cms (see web/.env.prod-cms.example)
```
