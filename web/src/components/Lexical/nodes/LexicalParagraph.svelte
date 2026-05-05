<script lang="ts">
  import type { SerializedParagraphNode } from '@payloadcms/richtext-lexical'
  import type { LexicalNode } from '@/types/lexical'
  import LexicalRenderer from '../LexicalRenderer.svelte'

  interface Props {
    node: SerializedParagraphNode
  }

  let { node }: Props = $props()
</script>

<p>
  <LexicalRenderer nodes={node.children as LexicalNode[]} />
</p>
