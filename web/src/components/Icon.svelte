<script lang="ts">
	import type { Snippet } from 'svelte'

	interface Props {
		children: Snippet
		size?: string
		width?: string
		height?: string
		color?: string
		marginInline?: string
		bottomOffset?: string
		strokeWidth?: string
		class?: string
	}

	let {
		children,
		size,
		width,
		height,
		color,
		marginInline,
		bottomOffset,
		strokeWidth,
		class: className = '',
	}: Props = $props()

	const styleString = $derived(
		[
			size && `--i-s--size: ${size}`,
			width && `--i-s--width: ${width}`,
			height && `--i-s--height: ${height}`,
			color && `--i-s--color: ${color}`,
			marginInline && `--i-s--margin-inline: ${marginInline}`,
			bottomOffset && `--i-s--bottom-offset: ${bottomOffset}`,
			strokeWidth && `--i-s--stroke-width: ${strokeWidth}`,
		]
			.filter(Boolean)
			.join('; '),
	)
</script>

<span class={['icon', className]} style={styleString || undefined}>
	{@render children()}
</span>

<style lang="scss">
	.icon {
		@include svg-icon-class;
	}
	.icon :global(svg) {
		@include svg-icon-svg;
	}
</style>
