<script lang="ts">
  import type { SerializedTextNode } from '@payloadcms/richtext-lexical'
  import { TEXT_FORMAT } from '@/types/lexical'

  interface Props {
    node: SerializedTextNode
  }

  let { node }: Props = $props()

  const html = $derived.by(() => {
    const fmt = node.format ?? 0
    let result = node.text ?? ''
    if (fmt & TEXT_FORMAT.CODE)          return `<code>${result}</code>`
    if (fmt & TEXT_FORMAT.SUPERSCRIPT)   result = `<sup>${result}</sup>`
    if (fmt & TEXT_FORMAT.SUBSCRIPT)     result = `<sub>${result}</sub>`
    if (fmt & TEXT_FORMAT.STRIKETHROUGH) result = `<s>${result}</s>`
    if (fmt & TEXT_FORMAT.UNDERLINE)     result = `<u>${result}</u>`
    if (fmt & TEXT_FORMAT.ITALIC)        result = `<em>${result}</em>`
    if (fmt & TEXT_FORMAT.BOLD)          result = `<strong>${result}</strong>`
    return result
  })
</script>

{@html html}
