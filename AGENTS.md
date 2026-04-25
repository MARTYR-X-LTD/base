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

### Portable commits

When a commit contains something reusable across projects, add `portable: yes` in the commit **body** — never in the header line:

```
[web] Cache: add stale-while-revalidate utility

portable: yes
Generic SWR helper with no project-specific config.
```

This flags the commit for later backporting to `MARTYR-X-LTD/base`. See `docs/base-porting.md` for the full porting workflow.

## Working from Root

Always run from the monorepo root (wherever `monk/` is cloned), even for frontend-only or CMS-only work. Git is at the root, and Claude loads all AGENTS.md files correctly from here.

Subproject AGENTS.md files are authoritative for their domain — read them before working in those areas:
- `web/AGENTS.md` — frontend patterns, tech stack, key gotchas
- `cms/AGENTS.md` — CMS patterns, migrations, access control, deployment

## Project Structure

- `web/` — Astro 6.1 frontend, SSR on Cloudflare Workers. See `web/AGENTS.md`.
- `cms/` — Payload CMS, Docker deployed to Coolify VPS. See `cms/AGENTS.md`.
- `docs/` — All project documentation (see Docs section below).

## Environment

Development happens on both macOS and Linux. Be mindful of platform differences: path separators, shell behavior, binary availability, and filesystem case-sensitivity. Never hardcode platform-specific paths or assume a specific OS.

## Tooling

- Use the `find-docs` skill to fetch current library docs before writing integration code.
- Use `/superpowers` skills: `subagent-driven-development`, `writing-plans`, `brainstorming`, `verification-before-completion`.

## Rules

### Package manager
Always use `pnpm`. Never use `npm` or `yarn`. Commands: `pnpm add`, `pnpm install`, `pnpm run <script>`.

### Dev servers
Never run `pnpm dev`, `pnpm preview`, or any long-running server. Instruct the user to run these in a separate terminal instead.

### Environment files
Never read `.env` files. Only `.env.example` files are safe to read if needed.

The single `.env.example` lives at the **monorepo root**. `init.sh` symlinks it into `cms/` and `web/` so both subprojects share the same env vars without duplication. When adding a new env var, add it once to the root `.env.example` — it is automatically available to both subprojects.

### Node version
Managed via `.node-version` files and `fnm`. Do not change Node versions manually.

### File paths
Always use absolute paths when reading or searching files. Derive the repo root from the current working directory — never hardcode a platform-specific path. Never assume a file doesn't exist based on a failed relative-path lookup — retry with the absolute path first.

## Docs

All documentation lives in `docs/` at the monorepo root. Never create docs inside `web/` or `cms/`.

```
docs/
  updating/
    web.md        — frontend dependency update guide
    cms.md        — CMS dependency update guide
  cms/            — CMS deep dives (Docker, R2, migrations, etc.)
  web/            — Frontend deep dives (Cloudflare, caching, editor-pattern, etc.)
  superpowers/
    specs/        — design specs from brainstorming sessions
    plans/        — implementation plans
  base-porting.md — how to backport features to MARTYR-X-LTD/base
```
