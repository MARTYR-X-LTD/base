<script lang="ts">
	import { Dialog, type WithChildren } from 'bits-ui'

	type Props = WithChildren<Dialog.ContentProps> & {
		title?: string
	}

	let { children, title, ...rest }: Props = $props()
</script>

<Dialog.Portal>
	<Dialog.Overlay>
		{#snippet child({ props, open })}
			{#if open}
				<div {...props} class="overlay"></div>
			{/if}
		{/snippet}
	</Dialog.Overlay>
	<Dialog.Content {...rest}>
		{#snippet child({ props, open })}
			{#if open}
				<div {...props} class="content">
					{#if title}
						<Dialog.Title class="title">{title}</Dialog.Title>
					{/if}
					{@render children?.()}
				</div>
			{/if}
		{/snippet}
	</Dialog.Content>
</Dialog.Portal>

<style lang="scss">
	@layer components {
		.overlay {
			position: fixed;
			inset: 0;
			background: var(--dialog-overlay--bg);
			z-index: 1200;
		}

		.content {
			position: fixed;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			background: var(--dialog--bg);
			border: var(--dialog--border);
			border-radius: 14px;
			box-shadow: var(--dialog--shadow);
			padding: 1rem;
			max-width: min(90vw, 800px);
			max-height: 90vh;
			overflow: auto;
			z-index: 1201;
		}

		.content :global(.title) {
			font-size: 1rem;
			margin: 0 0 0.75rem 0;
		}
	}
</style>
