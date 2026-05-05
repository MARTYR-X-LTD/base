type UrlMap = Map<string, string[]>

export class MediaPreloader {
  private loaded = new Set<string>()
  private urlMap: UrlMap
  private links: HTMLLinkElement[] = []

  constructor(urlMap: UrlMap) {
    this.urlMap = urlMap
  }

  warm(currentSlug: string, radius: number): void {
    const slugs = [...this.urlMap.keys()]
    const currentIdx = slugs.indexOf(currentSlug)
    if (currentIdx === -1) return

    const start = Math.max(0, currentIdx - radius)
    const end = Math.min(slugs.length - 1, currentIdx + radius)

    for (let i = start; i <= end; i++) {
      for (const url of this.urlMap.get(slugs[i]) ?? []) {
        if (this.loaded.has(url)) continue
        this.loaded.add(url)
        this.preloadUrl(url)
      }
    }
  }

  private preloadUrl(url: string): void {
    if (/\.(mp4|webm|mov)$/i.test(url)) {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.as = 'video'
      link.href = url
      document.head.appendChild(link)
      this.links.push(link)
    } else {
      const img = new Image()
      img.src = url
    }
  }

  destroy(): void {
    for (const link of this.links) link.remove()
    this.links = []
    this.loaded.clear()
  }
}
