<script lang="ts">
  import type { LinkFields } from '@/types/lexical'
  import type { SerializedLinkNode } from '@payloadcms/richtext-lexical'
  import type { LexicalNode } from '@/types/lexical'
  import LexicalRenderer from '../LexicalRenderer.svelte'

  interface Props {
    node: SerializedLinkNode & { fields: LinkFields }
  }

  let { node }: Props = $props()

  const url = $derived(node.fields?.url ?? '#')
  const newTab = $derived(node.fields?.newTab ?? false)
</script>

<a
  href={url}
  target={newTab ? '_blank' : undefined}
  rel={newTab ? 'noopener noreferrer' : undefined}
>
  <LexicalRenderer nodes={node.children as LexicalNode[]} />
</a>
