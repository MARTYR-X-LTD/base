<script lang="ts">
  import type { LexicalNode } from '@/types/lexical'
  import LexicalText from './nodes/LexicalText.svelte'
  import LexicalParagraph from './nodes/LexicalParagraph.svelte'
  import LexicalHeading from './nodes/LexicalHeading.svelte'
  import LexicalList from './nodes/LexicalList.svelte'
  import LexicalLink from './nodes/LexicalLink.svelte'
  import LexicalQuote from './nodes/LexicalQuote.svelte'
  import LexicalHorizontalRule from './nodes/LexicalHorizontalRule.svelte'
  import LexicalMedia from './nodes/LexicalMedia.svelte'

  interface Props {
    nodes: LexicalNode[]
  }

  let { nodes }: Props = $props()

  const componentMap: Record<string, any> = {
    text: LexicalText,
    paragraph: LexicalParagraph,
    heading: LexicalHeading,
    list: LexicalList,
    listitem: LexicalList,
    link: LexicalLink,
    quote: LexicalQuote,
    upload: LexicalMedia,
    horizontalrule: LexicalHorizontalRule,
  }
</script>

{#each nodes as node}
  {@const Component = componentMap[node.type]}
  {#if Component}
    <Component {node} />
  {:else if node.type === 'linebreak'}
    <br />
  {/if}
{/each}
