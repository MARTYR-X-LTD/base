# Frontend Guidelines

Patterns for writing Svelte 5 + bits-ui components in `web/`. Read this before touching frontend code so we don't re-litigate the same choices.

Reference project: `~/martyr/martyrio/web/` — zowie is a trimmed-down sibling of martyrio. When in doubt, grep martyrio for a similar component and mirror its shape.

---

## 1. `$effect` is the last resort

Svelte 5's `$effect` is tempting but almost always the wrong tool. Before reaching for it, check if one of these fits:

| Need | Use |
|------|-----|
| Value derived from state | `$derived(expr)` |
| Multi-step derivation or loop | `$derived.by(() => { … })` |
| Two-way binding in a child component | `$bindable()` |
| Event-driven state update | Plain handler (`onclick`, `onchange`, callback prop) |
| Lazy module load gated on a flag | Derived `import()` promise + `{#await}` in template |

`$effect` is only the right answer for **imperative browser APIs with cleanup**: `ResizeObserver`, `IntersectionObserver`, `MutationObserver`, event listeners on `window`/`document`, timers. That's it. Even then, mark it with a comment saying why so future-you doesn't second-guess.

### Anti-patterns we've already seen and removed

- `$effect(() => { internal = [value] })` to sync a prop into a local `$state`. Wrong — just use `$derived` or `$bindable`.
- `$effect(() => { runSolver(width, height) })` to recompute a value. Wrong — make the output itself a `$derived.by`.
- `$effect(() => { if (flag && !Component) import(...).then(…) })` to lazy-load. Wrong — `$derived(flag ? import(...) : null)` and drive mount with `{#await}`.

### Example: dynamic component load without `$effect`

```svelte
<script lang="ts">
  const editorModulePromise = $derived(
    editor ? import('./GridEditor.svelte') : null,
  )
</script>

{#if editorModulePromise}
  {#await editorModulePromise then mod}
    <mod.default {...props} />
  {/await}
{/if}
```

When docs are unclear, use the `find-docs` skill to fetch current Svelte 5 docs. Do not rely on training-data memory for the runes API — it has moved.

---

## 2. bits-ui — use the `child` snippet, avoid `:global()`

Most bits-ui components accept a `child` snippet that lets you render your own element and receive the spread-ready `props`. This is the right primitive because:

- You write a real element in your Svelte file, so scoped SCSS targets it normally.
- No need for `:global(...)` hacks that leak across the codebase.
- Svelte transitions, actions (`use:`), and conditional rendering all compose naturally.

### Simple (non-floating) components

```svelte
<Switch.Root bind:checked>
  {#snippet child({ props })}
    <button {...props} class="switch-root">
      <span class="switch-thumb" data-state={checked ? 'checked' : 'unchecked'}></span>
    </button>
  {/snippet}
</Switch.Root>

<style lang="scss">
  .switch-root { /* scoped — no :global needed */ }
  .switch-root[data-state='checked'] { /* bits-ui sets data-state for you */ }
</style>
```

### Floating components (Popover/Dialog/Tooltip/DropdownMenu/etc.)

These require a **two-level structure**: an unstyled outer wrapper with `{...wrapperProps}` for positioning, and an inner content element with `{...props}` for styling. Gate rendering on the `open` flag so Svelte transitions work.

```svelte
<Popover.Content>
  {#snippet child({ wrapperProps, props, open })}
    {#if open}
      <div {...wrapperProps}>
        <div {...props} class="content">…</div>
      </div>
    {/if}
  {/snippet}
</Popover.Content>
```

Full list of components needing the wrapper structure: `Combobox.Content`, `DatePicker.Content`, `DateRangePicker.Content`, `DropdownMenu.Content`, `LinkPreview.Content`, `Menubar.Content`, `Popover.Content`, `Select.Content`, `Tooltip.Content`.

### When `:global()` is acceptable

Some components (Button is the notable one in our codebase) do **not** expose a `child` snippet. For those, wrap the component in your own `<div class="button {variant}">` and use `:global([data-button-root])` in scoped SCSS to target the internal element. Keep `:global()` scoped to a bits-ui `data-*` attribute (never a plain class name) so the rule can't collide with anything else in the app.

```svelte
<div class="button {variant}" data-disabled={disabled}>
  <Button.Root {...rest}>{@render children?.()}</Button.Root>
</div>

<style lang="scss">
  .button :global([data-button-root]) { /* styles */ }
  .button[data-disabled='true'] :global([data-button-root]) { opacity: 0.5; }
</style>
```

Split floating components into a `Root` and `Content` file (`PopoverRoot.svelte` + `PopoverContent.svelte`, `DialogRoot.svelte` + `DialogContent.svelte`) so consumers compose them with `<Popover.Trigger>` in between. Mirrors martyrio.

---

## 3. Styling conventions

### CSS custom properties & tokens

All colors, shadows, borders, and component-specific variants live as CSS custom properties in `src/styles/_colors.scss`, following the naming convention documented at the top of that file:

```
--{component}[-sub][_variant][__state]--{property}

// Examples
--button_primary--bg
--button_ghost__hover--bg
--switch-thumb__off--bg
```

Components consume tokens; they do not hardcode colors. If you need a new color, add it to `_colors.scss` first. Generic values like spacing/radius can still be inline for prototyping, but promote them to tokens in `_vars.scss` or component-scoped `--v-*` variables as patterns solidify.

### Cascade layers

Component styles live inside `@layer components { … }` and accessibility rules in `@layer a11y { … }`. The layer order is declared in `_layers.scss`.

### Mixins

`_mixins.scss` exposes:

- `@mixin hover` — `@media (hover: hover) and (pointer: fine)`. Wrap `:hover` rules in this so touch devices don't trigger sticky hover.
- `@mixin coarse` — `@media (pointer: coarse)`. Use for touch-specific press feedback.
- Typography + icon mixins.

```scss
.button-ghost {
  @include hover {
    &:hover { background: var(--button_ghost__hover--bg); }
  }
  @include coarse {
    &:active { background: var(--button_ghost__pressed--bg); }
  }
}
```

### `--v-*` variant pattern (for Button and similar)

Button uses a variant-slot pattern: the base rule declares a handful of `--v-*` properties with fallbacks, and each variant class only overrides the slots it cares about:

```scss
.button :global([data-button-root]) {
  padding: var(--v-padding, 0.4rem 0.75rem);
  background: var(--v-background, transparent);
  color: var(--v-color, inherit);
  opacity: var(--v-opacity, 1);
}

.primary { --v-background: var(--button_primary--bg); }
.ghost   { --v-background: var(--button_ghost--bg); }
```

Nice because focus-visible, disabled, and state overrides all set the same slots without fighting specificity.

---

## 4. Component layout

- UI primitives live in `src/components/ui/` (`Button.svelte`, `Slider.svelte`, `Switch.svelte`, `PopoverRoot.svelte` + `PopoverContent.svelte`, `DialogRoot.svelte` + `DialogContent.svelte`, …).
- Feature components live alongside their feature (`src/components/home-grid/`, etc.).
- Don't re-export a bits-ui component without wrapping it — the wrapper is where the project's conventions attach.

When a new primitive is needed, check martyrio first (`~/martyr/martyrio/web/src/components/`). Port and adapt rather than invent.

---

## 5. Svelte 5 prop style

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte'
  import { Button, type WithoutChild } from 'bits-ui'

  type Props = WithoutChild<Button.RootProps> & {
    variant: 'primary' | 'ghost'
    children?: Snippet
  }

  let { variant, children, ...rest }: Props = $props()
</script>
```

- Use bits-ui's `WithoutChild<T>` (when you're replacing `child`) or `WithoutChildrenOrChild<T>` (when you're replacing both) to get a clean prop surface.
- `$bindable()` for two-way props. For renamed-key binding (`bind:open={() => open, (v) => setOpen(v)}`) use the function-binding form.
- Destructure `children` as a `Snippet`; use `{@render children?.()}` to render.

---

## 6. Before you touch a Svelte file, ask:

1. Am I about to write `$effect`? Can I use `$derived`/`$derived.by`/`$bindable` instead?
2. Does this bits-ui component expose a `child` snippet? Use it.
3. Am I writing `:global(.some-class)`? Stop — either use `child` or target a bits-ui `data-*` attribute.
4. Am I hardcoding a color? Add the token to `_colors.scss` first.
5. Is there a martyrio equivalent? Port it.
