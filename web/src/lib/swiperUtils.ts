import type { Swiper } from 'swiper'

/**
 * Preloads nearby slide images around the active Swiper slide.
 *
 * Converts images with `loading="lazy"` to `loading="eager"` for slides
 * within the given range of the active index, ensuring smooth transitions
 * and less visual popping when swiping.
 */
export function preloadNearbySlides(swiper: Swiper, swiperEl: HTMLElement, range = 2): void {
	if (!swiperEl || !swiper) return

	const slides = swiperEl.querySelectorAll<HTMLElement>('.swiper-slide')
	if (!slides.length) return

	for (let offset = -range; offset <= range; offset++) {
		const targetIndex = swiper.activeIndex + offset
		if (targetIndex < 0 || targetIndex >= slides.length) continue

		const images = slides[targetIndex].querySelectorAll<HTMLImageElement>('img[loading="lazy"]')
		images.forEach((img) => {
			img.loading = 'eager'
		})
	}
}

/**
 * Fixes cssMode + Navigation double-backward bug in Swiper.
 *
 * Overrides slidePrev() to use activeIndex instead of reading scroll position,
 * preventing the bug where clicking "previous" during an animation causes it to
 * go back two slides instead of one.
 */
export function fixCssModeSlidePrev(swiper: Swiper): void {
	swiper.slidePrev = function (speed?: number, runCallbacks?: boolean): boolean {
		const prevIndex = swiper.activeIndex - 1
		if (prevIndex < 0) return false
		return swiper.slideTo(prevIndex, speed, runCallbacks)
	}
}
