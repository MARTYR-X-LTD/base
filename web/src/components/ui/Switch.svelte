<script lang="ts">
	import { Switch, type WithoutChildrenOrChild } from 'bits-ui'

	type Props = WithoutChildrenOrChild<Switch.RootProps>

	let { checked = $bindable(false), ref = $bindable(null), ...rest }: Props = $props()
</script>

<Switch.Root bind:checked bind:ref {...rest}>
	{#snippet child({ props })}
		<button {...props} class="switch-root">
			<span class="switch-thumb" data-state={checked ? 'checked' : 'unchecked'}></span>
		</button>
	{/snippet}
</Switch.Root>

<style lang="scss">
	@layer components {
		.switch-root {
			--switch-width: 2.4rem;
			--switch-height: 1.3rem;
			--switch-gap: 0.15rem;
			--switch-thumb-size: calc(var(--switch-height) - var(--switch-gap) * 2);

			position: relative;
			display: inline-block;
			width: var(--switch-width);
			height: var(--switch-height);
			border: 0;
			padding: 0;
			border-radius: 9999px;
			background: var(--switch__off--bg);
			cursor: pointer;
			transition: background-color 0.15s ease;
			-webkit-appearance: none;
			appearance: none;

			&[data-state='checked'] {
				background: var(--switch__on--bg);
			}
			&[data-disabled] {
				opacity: 0.5;
				cursor: not-allowed;
			}
		}

		.switch-thumb {
			position: absolute;
			top: var(--switch-gap);
			left: var(--switch-gap);
			width: var(--switch-thumb-size);
			height: var(--switch-thumb-size);
			border-radius: 9999px;
			background: var(--switch-thumb--bg);
			transition: transform 0.2s cubic-bezier(0.29, 1.13, 0.7, 1);

			&[data-state='checked'] {
				transform: translateX(
					calc(var(--switch-width) - var(--switch-thumb-size) - var(--switch-gap) * 2)
				);
			}
		}
	}

	@layer a11y {
		.switch-root:focus-visible {
			outline: 2px solid var(--text);
			outline-offset: 2px;
		}
	}
</style>
