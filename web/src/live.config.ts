import { defineLiveCollection } from 'astro:content'
import { z } from 'astro/zod'
import type { Work, StoreProduct, Category } from '@cms/payload-types'
import { payloadLoader } from './lib/loaders/payload'

const API_URL = import.meta.env.CMS_API_URL
const API_KEY = import.meta.env.CMS_API_KEY

const works = defineLiveCollection({
  loader: payloadLoader<Work>({
    collection: 'works',
    apiUrl: API_URL,
    apiKey: API_KEY,
    cacheTags: (doc) => [`work-${doc.slug}`],
    collectionTag: 'works',
  }),
  schema: z.object({
    slug: z.string(),
    title: z.string(),
    category: z.any().optional(),
    featuredImage: z.any().optional(),
    mediaGallery: z.any().optional(),
    infoPanel: z.array(z.any()).optional(),
  }),
})

const storeProducts = defineLiveCollection({
  loader: payloadLoader<StoreProduct>({
    collection: 'store-products',
    apiUrl: API_URL,
    apiKey: API_KEY,
    cacheTags: (doc) => [`product-${doc.slug}`],
    collectionTag: 'products',
  }),
  schema: z.object({
    slug: z.string(),
    title: z.string(),
    featuredImage: z.any().optional(),
    mediaGallery: z.any().optional(),
    infoPanel: z.array(z.any()).optional(),
  }),
})

const categories = defineLiveCollection({
  loader: payloadLoader<Category>({
    collection: 'categories',
    apiUrl: API_URL,
    apiKey: API_KEY,
    cacheTags: (doc) => [`category-${doc.slug}`],
    collectionTag: 'categories',
  }),
  schema: z.object({
    slug: z.string(),
    name: z.string(),
  }),
})

export const collections = { works, storeProducts, categories }
