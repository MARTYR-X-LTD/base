interface PayloadLoaderOptions {
  collection: string
  apiUrl: string
  apiKey: string
  cacheTags: (doc: any) => string[]
  collectionTag: string
}

export function payloadLoader(options: PayloadLoaderOptions) {
  return {
    async loadCollection({ cookies }: { cookies: any }) {
      if (!options.apiUrl || !options.apiKey) {
        console.warn(`[payload] Missing CMS_API_URL or CMS_API_KEY — skipping fetch for "${options.collection}"`)
        return { entries: [], cacheHint: { tags: [options.collectionTag] } }
      }

      const isDraft = cookies?.get('draft')?.value === 'true'

      const params = new URLSearchParams({
        depth: '2',
        limit: '100',
        ...(isDraft && { draft: 'true' }),
      })

      const response = await fetch(
        `${options.apiUrl}/${options.collection}?${params}`,
        {
          headers: {
            Authorization: `users API-Key ${options.apiKey}`,
          },
        },
      )

      if (!response.ok) {
        console.warn(`[payload] ${response.status} ${response.statusText} — "${options.collection}" collection fetch failed. Check CMS_API_KEY in .env`)
        return {
          entries: [],
          cacheHint: { tags: [options.collectionTag] },
        }
      }

      const data = await response.json()

      if (!data.docs) {
        console.warn(`[payload] Unexpected response shape for "${options.collection}":`, JSON.stringify(data))
        return { entries: [], cacheHint: { tags: [options.collectionTag] } }
      }

      return {
        entries: data.docs.map((doc: any) => ({
          id: doc.id,
          slug: doc.slug,
          data: doc,
        })),
        cacheHint: {
          tags: [
            options.collectionTag,
            ...data.docs.flatMap((doc: any) => options.cacheTags(doc)),
          ],
          ...(data.docs.length > 0 && {
            lastModified: new Date(
              Math.max(...data.docs.map((d: any) => new Date(d.updatedAt).getTime())),
            ),
          }),
        },
      }
    },

    async loadEntry({ slug, cookies }: { slug: string; cookies: any }) {
      if (!options.apiUrl || !options.apiKey) {
        console.warn(`[payload] Missing CMS_API_URL or CMS_API_KEY — skipping fetch for "${options.collection}/${slug}"`)
        return { entry: null, error: 'CMS not configured' }
      }

      const isDraft = cookies?.get('draft')?.value === 'true'

      const params = new URLSearchParams({
        depth: '2',
        'where[slug][equals]': slug,
        ...(isDraft && { draft: 'true' }),
      })

      const response = await fetch(
        `${options.apiUrl}/${options.collection}?${params}`,
        {
          headers: {
            Authorization: `users API-Key ${options.apiKey}`,
          },
        },
      )

      if (!response.ok) {
        console.warn(`[payload] ${response.status} ${response.statusText} — "${options.collection}/${slug}" entry fetch failed. Check CMS_API_KEY in .env`)
        return { entry: null, error: 'Failed to fetch entry' }
      }

      const data = await response.json()

      if (data.docs.length === 0) {
        return { entry: null, error: 'Entry not found' }
      }

      const doc = data.docs[0]

      return {
        entry: {
          id: doc.id,
          slug: doc.slug,
          data: doc,
        },
        cacheHint: {
          tags: [options.collectionTag, ...options.cacheTags(doc)],
          lastModified: new Date(doc.updatedAt),
        },
      }
    },
  }
}
