import type { LiveLoader, LoadEntryContext, LoadCollectionContext } from 'astro/loaders'

interface PayloadDoc {
  id: number
  updatedAt: string
}

interface PayloadLoaderOptions<TDoc extends PayloadDoc> {
  collection: string
  cacheTags: (doc: TDoc) => string[]
  collectionTag: string
  sort?: string
}

type PayloadEntryFilter = { id: string; draft?: boolean }
type PayloadCollectionFilter = { draft?: boolean }

// Detects whether a type is a Payload relationship field (union that includes an object type).
// Distinguishes `number | Media | null` (relationship) from `number | null` (plain optional number).
type IsRelation<T> = [true] extends [T extends object ? true : never] ? true : false

// Recursively strips unpopulated `number` IDs from relationship fields, leaving
// plain number fields (id, width, order, etc.) untouched.
export type Populated<T> =
  T extends (infer U)[]
    ? Populated<U>[]
    : T extends object
    ? { [K in keyof T]: IsRelation<T[K]> extends true ? Populated<Exclude<T[K], number>> : Populated<T[K]> }
    : T

export function payloadLoader<TDoc extends PayloadDoc>(
  options: PayloadLoaderOptions<TDoc>,
) {
  const apiUrl = import.meta.env.CMS_API_URL
  const apiKey = import.meta.env.CMS_API_KEY

  async function fetchPayload(params: URLSearchParams): Promise<Response | null> {
    if (!apiUrl || !apiKey) {
      console.warn(`[payload] Missing CMS_API_URL or CMS_API_KEY — skipping fetch for "${options.collection}"`)
      return null
    }
    return fetch(`${apiUrl}/${options.collection}?${params}`, {
      headers: { Authorization: `users API-Key ${apiKey}` },
    })
  }

  function mapEntry(doc: TDoc) {
    return {
      id: String(doc.id),
      data: doc as Populated<TDoc>,
      cacheHint: {
        tags: [options.collectionTag, ...options.cacheTags(doc)],
        lastModified: new Date(doc.updatedAt),
      },
    }
  }

  return {
    name: options.collection,

    async loadCollection(context: LoadCollectionContext<PayloadCollectionFilter>) {
      const params = new URLSearchParams({
        depth: '2',
        limit: '100',
        ...(options.sort && { sort: options.sort }),
        ...(context.filter?.draft && { draft: 'true' }),
      })

      const response = await fetchPayload(params)
      if (!response) return { entries: [], cacheHint: { tags: [options.collectionTag] } }

      if (!response.ok) {
        console.warn(`[payload] ${response.status} ${response.statusText} — "${options.collection}" fetch failed`)
        return { entries: [], cacheHint: { tags: [options.collectionTag] } }
      }

      const data = await response.json()
      if (!data.docs) {
        console.warn(`[payload] Unexpected response shape for "${options.collection}":`, JSON.stringify(data))
        return { entries: [], cacheHint: { tags: [options.collectionTag] } }
      }

      const docs: TDoc[] = data.docs
      const cacheHint = docs.length > 0
        ? {
            tags: [options.collectionTag, ...docs.flatMap(options.cacheTags)],
            lastModified: new Date(Math.max(...docs.map(d => new Date(d.updatedAt).getTime()))),
          }
        : undefined

      return { entries: docs.map(mapEntry), cacheHint }
    },

    async loadEntry(context: LoadEntryContext<PayloadEntryFilter>) {
      const slug = context.filter.id
      const params = new URLSearchParams({
        depth: '2',
        'where[slug][equals]': slug,
        ...(context.filter.draft && { draft: 'true' }),
      })

      const response = await fetchPayload(params)
      if (!response) return { error: new Error('CMS not configured') }

      if (!response.ok) {
        console.warn(`[payload] ${response.status} ${response.statusText} — "${options.collection}/${slug}" fetch failed`)
        return { error: new Error('Failed to fetch entry') }
      }

      const data = await response.json()
      if (!data.docs?.length) return { error: new Error('Entry not found') }

      return mapEntry(data.docs[0] as TDoc)
    },
  } as LiveLoader<Populated<TDoc>, PayloadEntryFilter, PayloadCollectionFilter, Error>
}
