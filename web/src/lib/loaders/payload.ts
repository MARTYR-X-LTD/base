import type { LiveLoader, LoadEntryContext, LoadCollectionContext } from 'astro/loaders'

interface PayloadDoc {
  id: number
  updatedAt: string
}

interface PayloadLoaderOptions<TDoc extends PayloadDoc> {
  collection: string
  apiUrl: string
  apiKey: string
  cacheTags: (doc: TDoc) => string[]
  collectionTag: string
}

type PayloadEntryFilter = { id: string; draft?: boolean }
type PayloadCollectionFilter = { draft?: boolean }

export function payloadLoader<TDoc extends PayloadDoc>(
  options: PayloadLoaderOptions<TDoc>,
) {
  return {
    name: options.collection,

    async loadCollection(
      context: LoadCollectionContext<PayloadCollectionFilter>,
    ) {
      if (!options.apiUrl || !options.apiKey) {
        console.warn(`[payload] Missing CMS_API_URL or CMS_API_KEY — skipping fetch for "${options.collection}"`)
        return { entries: [], cacheHint: { tags: [options.collectionTag] } }
      }

      const params = new URLSearchParams({
        depth: '2',
        limit: '100',
        ...(context.filter?.draft && { draft: 'true' }),
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

      const entries = data.docs.map((doc: TDoc) => ({
        id: String(doc.id),
        data: doc,
      }))

      const tags = [
        options.collectionTag,
        ...data.docs.flatMap((doc: TDoc) => options.cacheTags(doc)),
      ]

      const cacheHint = data.docs.length > 0
        ? {
            tags,
            lastModified: new Date(
              Math.max(...data.docs.map((d: TDoc) => new Date(d.updatedAt).getTime())),
            ),
          }
        : undefined

      return { entries, cacheHint }
    },

    async loadEntry(
      context: LoadEntryContext<PayloadEntryFilter>,
    ) {
      const slug = context.filter.id
      const isDraft = context.filter.draft ?? false

      if (!options.apiUrl || !options.apiKey) {
        console.warn(`[payload] Missing CMS_API_URL or CMS_API_KEY — skipping fetch for "${options.collection}/${slug}"`)
        return { error: new Error('CMS not configured') }
      }

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
        return { error: new Error('Failed to fetch entry') }
      }

      const data = await response.json()

      if (data.docs.length === 0) {
        return { error: new Error('Entry not found') }
      }

      const doc = data.docs[0] as TDoc

      return {
        id: String(doc.id),
        data: doc,
        cacheHint: {
          tags: [options.collectionTag, ...options.cacheTags(doc)],
          lastModified: new Date(doc.updatedAt),
        },
      }
    },
  } as LiveLoader<Record<string, unknown>, PayloadEntryFilter, PayloadCollectionFilter, Error>
}
