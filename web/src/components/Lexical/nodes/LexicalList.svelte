<script lang="ts">
  import type { SerializedListNode, SerializedListItemNode } from '@payloadcms/richtext-lexical'
  import type { LexicalNode } from '@/types/lexical'
  import LexicalRenderer from '../LexicalRenderer.svelte'

  interface Props {
    node: SerializedListNode | SerializedListItemNode
  }

  let { node }: Props = $props()

  const isListContainer = $derived('tag' in node || 'listType' in node)
  const Tag = $derived(('tag' in node
    ? node.tag
    : 'listType' in node && node.listType === 'number'
      ? 'ol'
      : 'ul') as keyof HTMLElementTagNameMap)
</script>

{#if isListContainer}
  <svelte:element this={Tag}>
    <LexicalRenderer nodes={node.children as LexicalNode[]} />
  </svelte:element>
{:else}
  <li>
    <LexicalRenderer nodes={node.children as LexicalNode[]} />
  </li>
{/if}
