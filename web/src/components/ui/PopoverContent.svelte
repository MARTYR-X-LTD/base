<script lang="ts">
	import { Popover, type WithChildren } from 'bits-ui'

	type Props = WithChildren<Popover.ContentProps>

	let { children, ...rest }: Props = $props()
</script>

<Popover.Content sideOffset={6} {...rest}>
	{#snippet child({ wrapperProps, props, open })}
		{#if open}
			<div {...wrapperProps} class="wrapper">
				<div {...props} class="content">
					{@render children?.()}
				</div>
			</div>
		{/if}
	{/snippet}
</Popover.Content>

<style lang="scss">
	@layer components {
		.content {
			background: var(--popover--bg);
			border: var(--popover--border);
			border-radius: 10px;
			box-shadow: var(--popover--shadow);
			padding: 0.25rem;
			z-index: 1100;
		}
	}
</style>
