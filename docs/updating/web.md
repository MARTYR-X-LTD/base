# Updating Web Dependencies

## Workflow

1. Fetch changelogs for major dependencies (Astro, Svelte, bits-ui, swiper, etc.) via Context7 MCP
2. Update dependencies in `web/package.json`
3. Run `pnpm install` in `web/`
4. Test:
   - `pnpm dev` — verify dev server starts
   - `pnpm build` — verify production build succeeds
   - Check key routes work in dev and preview
5. Commit with `[web] Deps: update <package> to vX.Y.Z`

## Key Dependencies to Watch

- **Astro** — check for breaking changes in config, adapters, APIs
- **@astrojs/cloudflare** — verify compatibility with Astro version
- **@astrojs/svelte** — check Svelte integration changes
- **wrangler** — update `compatibility_date` in `wrangler.jsonc` when needed
- **unplugin-icons** — verify compiler compatibility

## Node Version

Managed by `.node-version` (Node 24 LTS via fnm). Update if needed.

## PNPM Version

Pinned in `package.json` as `"packageManager": "pnpm@X.Y.Z"`. Update when upgrading pnpm intentionally.

## Cloudflare Notes

- Cloudflare builds from `web/` directory on push to `main`
- Verify `wrangler.jsonc` `compatibility_date` is current after major updates
- Test with `pnpm preview` after build to catch runtime issues
