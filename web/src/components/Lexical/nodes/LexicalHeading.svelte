<script lang="ts">
  import type { SerializedHeadingNode } from '@payloadcms/richtext-lexical'
  import type { LexicalNode } from '@/types/lexical'
  import LexicalRenderer from '../LexicalRenderer.svelte'
  import { slugify, extractLexicalText } from '@/utils/etc'

  interface Props {
    node: SerializedHeadingNode
  }

  let { node }: Props = $props()

  const Tag = $derived(node.tag as keyof HTMLElementTagNameMap)
  const id = $derived(slugify(extractLexicalText(node.children as Parameters<typeof extractLexicalText>[0])))
</script>

<svelte:element this={Tag} {id}>
  <LexicalRenderer nodes={node.children as LexicalNode[]} />
</svelte:element>
