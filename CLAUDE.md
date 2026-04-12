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

## Working from Root

Always run Claude Code from the monorepo root (`/Users/arecsu/o3/monk`), even for frontend-only or CMS-only work. Git is at the root, and Claude loads all CLAUDE.md files correctly from here.

Subproject CLAUDE.md files are authoritative for their domain — read them before working in those areas:
- `web/CLAUDE.md` — frontend patterns, tech stack, key gotchas
- `cms/CLAUDE.md` — CMS patterns, migrations, access control, deployment

## Project Structure

- `web/` — Astro 6.1 frontend, SSR on Cloudflare Workers. See `web/CLAUDE.md`.
- `cms/` — Payload CMS, Docker deployed to Coolify VPS. See `cms/CLAUDE.md`.
- `docs/` — All project documentation (see Docs section below).

## Tooling

- Use **Context7 MCP** to fetch current library docs before writing integration code.
- Use `/superpowers` skills: `subagent-driven-development`, `writing-plans`, `brainstorming`, `verification-before-completion`.

## Rules

### Package manager
Always use `pnpm`. Never use `npm` or `yarn`. Commands: `pnpm add`, `pnpm install`, `pnpm run <script>`.

### Dev servers
Never run `pnpm dev`, `pnpm preview`, or any long-running server. Instruct the user to run these in a separate terminal instead.

### Environment files
Never read `.env` files. Only `.env.example` files are safe to read if needed.

### Node version
Managed via `.node-version` files and `fnm`. Do not change Node versions manually.

## Docs

All documentation lives in `docs/` at the monorepo root. Never create docs inside `web/` or `cms/`.

```
docs/
  updating/
    web.md        — frontend dependency update guide
    cms.md        — CMS dependency update guide
  cms/            — CMS deep dives (Docker, R2, migrations, etc.)
  web/            — Frontend deep dives (Cloudflare, caching, etc.)
  superpowers/
    specs/        — design specs from brainstorming sessions
    plans/        — implementation plans
```
