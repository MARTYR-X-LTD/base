<script lang="ts">
	import Icon from '@/components/Icon.svelte'
	import IconArrowRight from '~icons/ph/caret-circle-right-fill'
	import IconArrowLeft from '~icons/ph/caret-circle-left-fill'

	type Props = {
		prevClass?: string
		nextClass?: string
	}

	let { prevClass, nextClass }: Props = $props()
</script>

<div class={['prev swiper-button-disabled', prevClass]}>
	<Icon><IconArrowLeft /></Icon>
</div>
<div class={['next swiper-button-disabled', nextClass]}>
	<Icon><IconArrowRight /></Icon>
</div>

<style lang="scss">
	.prev,
	.next {
		display: flex;
		position: relative;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		box-shadow: 0 0 0.1em rgb(0 0 0 / 0.1);
		border-radius: 50%;
		overflow: hidden;
		transition: opacity 0.3s 0.1s ease;
		opacity: 0.85;
		pointer-events: auto;

		&:global(.swiper-button-disabled) {
			opacity: 0;
		}

		:global(svg) {
			scale: 1.3;
		}
		:global(svg path) {
			fill: var(--swiper-bullet--bg);
		}

		&::after {
			content: '';
			height: 70%;
			width: 70%;
			background-color: var(--text);
			position: absolute;
			z-index: -1;
			border-radius: 50%;
		}
	}

	.swiper-button-disabled {
		cursor: default;
	}
</style>
