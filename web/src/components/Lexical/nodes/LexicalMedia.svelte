<script lang="ts">
  import type { MediaUploadNode } from '@/types/lexical'

  interface Props {
    node: MediaUploadNode
  }

  let { node }: Props = $props()

  const media = $derived(typeof node.value !== 'string' ? node.value : null)
  const isSVG = $derived(media?.mimeType === 'image/svg+xml')
  const isVideo = $derived(media?.mimeType?.startsWith('video/'))

  const {
    caption,
    maxWidth,
    figureMargin,
    imgPadding,
    customFigureStyle,
    customImgStyle,
  } = $derived(node.fields ?? {})

  function mergeStyles(specificRules: { property: string; value: string }[], customCss?: string): string {
    const cssMap = new Map<string, string>()
    for (const { property, value } of specificRules) {
      if (value) cssMap.set(property, value)
    }
    if (customCss) {
      customCss.split(';').forEach((rule) => {
        const trimmed = rule.trim()
        if (!trimmed) { return }

        const colonIndex = trimmed.indexOf(':')
        if (colonIndex === -1) { return }

        const property = trimmed.substring(0, colonIndex).trim()
        const value = trimmed.substring(colonIndex + 1).trim()

        if (property && value) {
          cssMap.set(property, value)
        }
      })
    }
    return Array.from(cssMap.entries()).map(([p, v]) => `${p}: ${v}`).join('; ')
  }

  const figureStyle = $derived(mergeStyles([
    { property: 'max-width', value: maxWidth || '' },
    { property: 'margin', value: figureMargin || '' },
  ], customFigureStyle))

  const imgStyle = $derived(mergeStyles([
    { property: 'padding', value: imgPadding || '' },
  ], customImgStyle))

  const srcset = $derived(media?.variants?.map(v => `${v.url} ${v.width}w`).join(', ') || '')
  const src = $derived(media?.variants?.[0]?.url ?? media?.url ?? '')
</script>

{#if media && isSVG}
  <figure style={figureStyle || undefined}>
    {@html media.svgContent}
    {#if caption}<figcaption>{caption}</figcaption>{/if}
  </figure>
{/if}
{#if media && !isSVG && !isVideo}
  <figure style={figureStyle || undefined}>
    <img src={src} srcset={srcset || undefined} sizes={srcset ? 'auto' : undefined}
      alt={media.alt || ''} width={media.width ?? undefined} height={media.height ?? undefined}
      loading="lazy" style={imgStyle || undefined} />
    {#if caption}<figcaption>{caption}</figcaption>{/if}
  </figure>
{/if}
{#if media && isVideo}
  <figure style={figureStyle || undefined}>
    <video width={media.width ?? undefined} height={media.height ?? undefined}
      autoplay={media.videoMetadata?.autoplay ?? true}
      muted={media.videoMetadata?.muted ?? true}
      loop={media.videoMetadata?.loop ?? true}
      controls={media.videoMetadata?.controls ?? true}
      playsinline={media.videoMetadata?.playsinline ?? true}
      style={imgStyle || undefined}>
      <source src={media.url ?? ''} type={media.mimeType || 'video/mp4'} />
    </video>
    {#if caption}<figcaption>{caption}</figcaption>{/if}
  </figure>
{/if}

<style lang="scss">
  @layer components {
    figure {
      margin-block: 2rem;
      margin-inline: auto;
    }
    img, video {
      width: 100%;
      height: auto;
      margin-inline: auto;
    }
    figcaption {
      margin-top: 0.9rem;
      font-size: 0.95em;
      color: var(--text-muted);
      text-align: center;
    }
  }
</style>
