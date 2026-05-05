<script lang="ts">
  import type { SerializedQuoteNode } from '@payloadcms/richtext-lexical'
  import type { LexicalNode } from '@/types/lexical'
  import LexicalRenderer from '../LexicalRenderer.svelte'

  interface Props {
    node: SerializedQuoteNode
  }

  let { node }: Props = $props()
</script>

<blockquote>
  <LexicalRenderer nodes={node.children as LexicalNode[]} />
</blockquote>
