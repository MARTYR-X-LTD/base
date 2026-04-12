<script lang="ts">
	import type { Snippet } from 'svelte'

	let { children }: { children: Snippet } = $props()
</script>

<div class="swiper-slide">
	<div class="swiper-zoom-container">
		{@render children()}
	</div>
</div>
