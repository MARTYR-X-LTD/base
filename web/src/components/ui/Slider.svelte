<script lang="ts">
	import { Slider, type WithoutChildrenOrChild } from 'bits-ui'

	type Props = WithoutChildrenOrChild<Slider.RootProps>

	let { value = $bindable(), ...rest }: Props = $props()
</script>

<!--
  Destructuring `value` to make it $bindable means we lose the discriminated
  union over type='single' | 'multiple', so we `as any` the spread to keep
  the types calm. Same trick martyrio uses.
-->
<Slider.Root bind:value thumbPositioning="exact" {...rest as any}>
	{#snippet child({ props })}
		<div {...props} class="slider-root">
			<span class="slider-track">
				<Slider.Range class="slider-range" />
			</span>
			<Slider.Thumb index={0} class="slider-thumb" />
		</div>
	{/snippet}
</Slider.Root>

<style lang="scss">
	$thumb-size: 1rem;

	@layer components {
		.slider-root {
			position: relative;
			display: flex;
			align-items: center;
			width: 100%;
			height: $thumb-size;
			touch-action: none;
			user-select: none;
		}

		.slider-track {
			position: relative;
			height: 4px;
			width: 100%;
			flex-grow: 1;
			overflow: hidden;
			border-radius: 9999px;
			background: var(--slider--bg);
			cursor: pointer;

			:global(.slider-range) {
				position: absolute;
				height: 100%;
				background: var(--slider--accent);
			}
		}

		.slider-root :global(.slider-thumb) {
			display: block;
			width: $thumb-size;
			height: $thumb-size;
			background: var(--slider--accent);
			border-radius: 9999px;
			cursor: grab;
			transition: transform 0.1s ease;

			@include hover {
				&:hover {
					transform: scale(1.1);
				}
			}

			&:active {
				cursor: grabbing;
				transform: scale(1.1);
			}
		}

		.slider-root :global(.slider-thumb[data-active]) {
			cursor: grabbing;
			transform: scale(1.1);
		}
	}

	@layer a11y {
		.slider-root :global(.slider-thumb:focus-visible) {
			outline: 2px solid var(--slider--accent);
			outline-offset: 2px;
		}
	}
</style>
