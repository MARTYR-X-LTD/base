<script lang="ts">
	import { Dialog, type WithChildren } from 'bits-ui'

	type Props = WithChildren<Dialog.RootProps>

	let { children, open = $bindable(), ...rest }: Props = $props()
</script>

<Dialog.Root bind:open {...rest}>
	{@render children?.()}
</Dialog.Root>
