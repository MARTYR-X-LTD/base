<script lang="ts">
	import type { Snippet } from 'svelte'
	import type { WithoutChild } from 'bits-ui'
	import { Button } from 'bits-ui'

	type Props = WithoutChild<Button.RootProps> & {
		children?: Snippet
		variant: 'primary' | 'ghost' | 'icon-circle'
	}

	let { children, variant, ...allProps }: Props = $props()
</script>

<div class={['button', variant]} data-disabled={allProps.disabled}>
	<Button.Root {...allProps}>
		{@render children?.()}
	</Button.Root>
</div>

<style lang="scss">
@mixin focus-visible-root {
	:global([data-button-root]:focus-visible) {
		@content;
	}
}

@layer components {
	.button {
		display: contents;
	}

	.button :global([data-button-root]) {
		display: grid;
		place-items: center;
		position: relative;
		overflow: clip;
		text-box-trim: trim-end;
		padding: var(--v-padding, 0.5rem 1rem);
		border: var(--v-border, none);
		border-radius: var(--v-border-radius, 0.5rem);
		background: var(--v-background, none);
		box-shadow: var(--v-box-shadow, none);
		color: var(--v-color, inherit);
		opacity: var(--v-opacity, 1);
		scale: var(--v-scale, 1);
		outline: var(--v-outline, none);
		text-decoration: none;
		transition: background-color 0.15s ease, box-shadow 0.15s ease, scale 0.1s ease-out, opacity 0.15s ease;
	}

	.primary {
		--v-background: var(--button_primary--bg);
		--v-color: var(--button_primary--color);
	}

	.ghost {
		--v-background: var(--button_ghost--bg);

		@include hover {
			&:hover {
				--v-background: var(--button_ghost__hover--bg);
			}
			&:active {
				--v-background: var(--button_ghost__pressed--bg);
			}
		}

		@include coarse {
			&:active {
				--v-background: var(--button_ghost__pressed--bg);
			}
		}
	}

	.icon-circle {
		--v-padding: 0.3rem;
		--v-border-radius: 999rem;

		@include hover {
			&:hover {
				--v-background: var(--button_icon-circle__hover--bg);
			}
		}
	}
}

@layer a11y {
	.primary,
	.ghost {
		@include focus-visible-root {
			--v-box-shadow: inset 0 0 0 3px var(--text);
		}
	}

	.icon-circle {
		@include focus-visible-root {
			--v-background: var(--button_icon-circle__hover--bg);
			--v-box-shadow: inset 0 0 0 2px var(--text);
		}
	}
}
</style>
