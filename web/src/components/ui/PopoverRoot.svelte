<script lang="ts">
	import { Popover, type WithChildren } from 'bits-ui'

	type Props = WithChildren<Popover.RootProps>

	let { children, open = $bindable(), ...rest }: Props = $props()
</script>

<Popover.Root bind:open {...rest}>
	{@render children?.()}
</Popover.Root>
