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
        return {
          entries: [],
          cacheHint: { tags: [options.collectionTag] },
        }
      }

      const data = await response.json()

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
          lastModified: new Date(
            Math.max(...data.docs.map((d: any) => new Date(d.updatedAt).getTime())),
          ),
        },
      }
    },

    async loadEntry({ slug, cookies }: { slug: string; cookies: any }) {
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
