# Porting Features to `base`

`base` (`MARTYR-X-LTD/base`) is the foundation repo all MARTYR-X-LTD projects are cloned from. When you build something reusable in a project, you can port it back to `base` so future projects start with it.

This doc lives in each derived project (like `monk`) as a reminder of the workflow.

## Marking portable commits

When writing a commit that contains something reusable, add `portable: yes` in the commit body — never in the header:

```
[web] Cache: add stale-while-revalidate utility

portable: yes
Generic SWR helper, no project-specific config.
```

This is a note of intent, not a git mechanism. It means: "this is worth reviewing for backport."

## Finding portable candidates

From inside any project:

```bash
git log --grep="portable: yes" --oneline
```

## Porting to `base`

Work happens inside a local clone of `base` — never inside the project tree. This keeps the project untouched.

```bash
# one-time: clone base somewhere outside your project
git clone https://github.com/MARTYR-X-LTD/base ~/code/base
cd ~/code/base
```

Then, for each porting session:

```bash
# fetch the source project's commits into base's local object store
git fetch https://github.com/MARTYR-X-LTD/monk main

# inspect what you're porting
git show <sha>

# if clean and self-contained: cherry-pick directly
git cherry-pick <sha>

# if entangled with project-specific code: manually re-implement
# open both repos side by side, extract the portable core, commit from scratch
git add <files>
git commit -m "[scope] Area: description"

# push when done
git push
```

## Porting between sibling projects

Same pattern — fetch the source, cherry-pick or manually extract, push.

```bash
# inside client-b clone
git fetch https://github.com/MARTYR-X-LTD/monk main
git cherry-pick <sha>
```

## Cherry-pick vs manual extraction

| Situation | Method |
|---|---|
| Commit is atomic, no project-specific code | `cherry-pick` |
| Commit is mostly portable, small entanglement | `git show <sha>` as reference, apply relevant parts manually |
| Feature grew large and project-specific | Open both repos, re-implement the portable core from scratch in `base` |

The `portable: yes` marker flags intent. Whether cherry-pick works is decided case by case.

## Shared plugins (future)

For plugins used across 3+ projects (e.g. the AVIF media encoder), consider extracting to a private npm package under `@martyr-x-ltd/`. See conversation notes on when this threshold makes sense.
