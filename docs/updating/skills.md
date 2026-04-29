# Skills Update Guide

Skills in `.agents/skills/` are installed via `npx ctx7 skills install` and may need updating as the source libraries evolve.

## Payload

```bash
npx ctx7 skills install /payloadcms/payload payload --universal
```

Run from the monorepo root. This overwrites `.agents/skills/payload/` with the latest version.

## Checking what's installed

```bash
ls .agents/skills/
```

If a skill stops referencing the right APIs or misses new patterns, reinstall it.
