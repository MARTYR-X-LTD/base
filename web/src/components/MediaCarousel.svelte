<script lang="ts">
	import { onMount, tick } from 'svelte'
	import type { Snippet } from 'svelte'
	import Swiper from 'swiper'
	import type { Swiper as SwiperType } from 'swiper'
	import { Navigation, Pagination, Keyboard } from 'swiper/modules'
	import CarouselNavigation from './CarouselNavigation.svelte'
	import { preloadNearbySlides, fixCssModeSlidePrev } from '@lib/swiperUtils'
	import 'swiper/css'
	import 'swiper/css/navigation'
	import 'swiper/css/keyboard'
	import 'swiper/css/zoom'

	let { children }: { children: Snippet } = $props()

	let swiperEl = $state<HTMLElement>()
	let swiper = $state<SwiperType>()

	// Pagination window config
	const PADDING     = 2     // fully-visible dots on each side of active
	const EDGE_LAYERS = 1     // graduated fade-out layers beyond padding
	const BUFFER      = 2     // how far active can drift before window shifts
	const EDGE_SCALE  = 0.55  // scale for the fringe (edge) dot
	const PILL_WIDTH  = 3.33  // active dot width multiplier (20px / 6px base)

	let anchor = 0

	function getWindowSize(total: number) {
		return Math.min(1 + PADDING * 2 + EDGE_LAYERS * 2, total)
	}

	function updateAnchor(selected: number, total: number) {
		if (selected > anchor + BUFFER) anchor = selected - BUFFER
		if (selected < anchor - BUFFER) anchor = selected + BUFFER
		const ws   = getWindowSize(total)
		const half = Math.floor(ws / 2)
		anchor = Math.max(half, Math.min(anchor, total - 1 - half))
	}

	function getWindow(total: number) {
		const ws    = getWindowSize(total)
		const half  = Math.floor(ws / 2)
		const start = Math.max(0, Math.min(anchor - half, total - ws))
		return { start, end: start + ws - 1 }
	}

	function classify(index: number, sel: number, start: number, end: number) {
		if (index === sel)                return 'active'
		if (index < start || index > end) return 'invisible'

		const absDist     = Math.abs(index - sel)
		const slotsOnSide = index < sel ? (sel - start) : (end - sel)
		const edgesOnSide = Math.min(EDGE_LAYERS, Math.max(0, slotsOnSide - PADDING))
		const totalPadding = slotsOnSide - edgesOnSide

		if (absDist <= totalPadding) return 'visible'

		const posInEdgeZone = absDist - totalPadding
		if (posInEdgeZone >= 1 && posInEdgeZone <= edgesOnSide) return 'edge'

		return 'invisible'
	}

	function updateBullets(bullets: HTMLElement[], activeIndex: number) {
		const total = bullets.length
		updateAnchor(activeIndex, total)
		const { start, end } = getWindow(total)

		for (let i = 0; i < total; i++) {
			const dot = bullets[i]
			const cls = classify(i, activeIndex, start, end)
			const isActive  = cls === 'active'
			const isVisible = cls !== 'invisible'
			const s = isActive ? 1 : cls === 'visible' ? 1 : cls === 'edge' ? EDGE_SCALE : 0

			dot.style.setProperty('--s',  String(s))
			dot.style.setProperty('--o',  isVisible ? String(Math.min(1, s)) : '0')
			dot.style.setProperty('--v',  isVisible ? '1' : '0')
			dot.style.setProperty('--pw', isActive ? String(PILL_WIDTH) : '1')
			dot.classList.toggle('dot-active', isActive)
		}
	}

	onMount(() => {
		if (!swiperEl) return

		// Unwrap <astro-slot> to make slides direct children of swiper-wrapper
		const wrapper = swiperEl.querySelector('.swiper-wrapper')
		if (!wrapper) return
		const slot = wrapper.querySelector('astro-slot')
		if (slot) {
			while (slot.firstChild) {
				wrapper.insertBefore(slot.firstChild, slot)
			}
			wrapper.removeChild(slot)
		}

		swiper = new Swiper(swiperEl, {
			modules: [Navigation, Pagination, Keyboard],
			slidesPerView: 1,
			cssMode: true,
			pagination: {
				el: '.swiper-pagination',
			},
			navigation: {
				nextEl: '.nav-next',
				prevEl: '.nav-prev',
			},
			keyboard: {
				onlyInViewport: true,
			},
			on: {
				init: async (swiperInstance) => {
					fixCssModeSlidePrev(swiperInstance)
					if (swiperEl) {
						await tick()
						preloadNearbySlides(swiperInstance, swiperEl)
					}
					const bullets = Array.from(
						swiperEl?.querySelectorAll<HTMLElement>('.swiper-pagination-bullet') ?? [],
					)
					anchor = swiperInstance.activeIndex
					updateBullets(bullets, swiperInstance.activeIndex)
					requestAnimationFrame(() => {
						swiperEl?.querySelector('.swiper-pagination')?.classList.add('is-ready')
					})
				},
				activeIndexChange: (swiperInstance) => {
					if (swiperEl) preloadNearbySlides(swiperInstance, swiperEl)
					const bullets = Array.from(
						swiperEl?.querySelectorAll<HTMLElement>('.swiper-pagination-bullet') ?? [],
					)
					updateBullets(bullets, swiperInstance.activeIndex)
				},
				paginationRender: (swiperInstance) => {
					const bullets = Array.from(
						swiperEl?.querySelectorAll<HTMLElement>('.swiper-pagination-bullet') ?? [],
					)
					updateBullets(bullets, swiperInstance.activeIndex)
				},
			},
		})

		return () => swiper?.destroy(true, true)
	})
</script>

<div class="media-carousel">
	<div class="swiper" bind:this={swiperEl}>
		<div class="swiper-wrapper">
			{@render children()}
		</div>
		<div class="swiper-buttons-container">
			<div>
				<CarouselNavigation prevClass="nav-prev" nextClass="nav-next" />
			</div>
		</div>
		<div class="swiper-pagination"></div>
	</div>
</div>

<style>
	.media-carousel {
		width: 100%;
		height: 100%;
	}

	@media (pointer: fine) {
		.swiper:hover .swiper-buttons-container {
			opacity: 1;
			transition-delay: 0s;
		}
	}

	.media-carousel .swiper {
		display: grid;
		grid-template-areas:
			'slides'
			'pagination';
		gap: 1rem;
		justify-items: center;
		height: 100%;
	}

	.media-carousel .swiper-wrapper {
		grid-area: slides;
		overflow: auto;
		scrollbar-width: none;
		aspect-ratio: 1 / 1;
	}

	.media-carousel .swiper-pagination {
		grid-area: pagination;
		position: static;
		transform: none;
		height: 2rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
	}

	:global(.media-carousel .swiper-pagination.is-ready) {
		animation: pagination-fadein 0.4s ease both;
	}

	:global {
		@keyframes pagination-fadein {
			from { opacity: 0; }
			to   { opacity: 1; }
		}
	}

	/*
	 * Dynamic bullets: CSS custom property driven.
	 * JS sets --s (scale), --o (opacity), --v (visible flag 0|1), --pw (pill width)
	 * on each bullet. CSS calc() drives all layout from those vars.
	 */
	:global(.media-carousel .swiper-pagination .swiper-pagination-bullet) {
		--base: 6px;
		--gap:  4px;
		--s:    0;
		--o:    0;
		--v:    0;
		--pw:   1;

		background-color: var(--swiper-bullet--bg);
		width:         calc(var(--base) * var(--s) * var(--pw));
		height:        calc(var(--base) * var(--s));
		margin:        0 calc(var(--gap) * var(--v));
		opacity:       var(--o);
		border-radius: calc(var(--base) * var(--s) / 2);
		flex-shrink:   0;
		transition:
			width         0.3s cubic-bezier(0.4, 0, 0.2, 1),
			height        0.3s cubic-bezier(0.4, 0, 0.2, 1),
			margin        0.3s cubic-bezier(0.4, 0, 0.2, 1),
			opacity       0.3s cubic-bezier(0.4, 0, 0.2, 1),
			border-radius 0.3s cubic-bezier(0.4, 0, 0.2, 1),
			background-color 0.2s ease;
	}

	:global(.media-carousel .swiper-pagination .swiper-pagination-bullet.dot-active) {
		background-color: var(--swiper-bullet__selected--bg);
	}

	.swiper-buttons-container {
		width: 100%;
		grid-area: slides;
		height: 100%;
		z-index: 5;
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.2s ease 0.3s;
	}

	@media (pointer: coarse) {
		.swiper-buttons-container {
			display: none;
		}
	}

	.swiper-buttons-container div {
		pointer-events: none;
		width: 100%;
		padding: 0.8rem;
		height: 100%;
		display: flex;
		flex-direction: row;
		font-size: clamp(2rem, 8.2vw, 2.4rem);
		justify-content: space-between;
		align-items: center;
	}
</style>
