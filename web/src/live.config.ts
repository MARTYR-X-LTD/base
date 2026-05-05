import { defineLiveCollection } from 'astro:content'
import type { LiveLoader } from 'astro/loaders'
import type {
  Work as PayloadWork,
  StoreProduct as PayloadStoreProduct,
  Category as PayloadCategory,
} from '@cms/payload-types'
import { payloadLoader } from './lib/loaders/payload'

type LiveData<T extends { loader: LiveLoader }> =
  T['loader'] extends LiveLoader<infer D, any, any, any> ? D : never

const works = defineLiveCollection({
  loader: payloadLoader<PayloadWork>({
    collection: 'works',
    cacheTags: (doc) => [`work-${doc.slug}`],
    collectionTag: 'works',
  }),
})

const storeProducts = defineLiveCollection({
  loader: payloadLoader<PayloadStoreProduct>({
    collection: 'store-products',
    cacheTags: (doc) => [`product-${doc.slug}`],
    collectionTag: 'products',
  }),
})

const categories = defineLiveCollection({
  loader: payloadLoader<PayloadCategory>({
    collection: 'categories',
    cacheTags: (doc) => [`category-${doc.slug}`],
    collectionTag: 'categories',
  }),
})

export const collections = { works, storeProducts, categories }

export type { LiveData }
export type Work = LiveData<typeof works>
export type Category = LiveData<typeof categories>
export type StoreProduct = LiveData<typeof storeProducts>
