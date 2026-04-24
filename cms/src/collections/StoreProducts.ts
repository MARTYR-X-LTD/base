import type { CollectionConfig } from 'payload'
import { adminsOnly } from '@/lib/access-control'
import { purgeCache } from '@/hooks/purgeCache'
import { mediaGalleryField } from '@/fields/mediaGallery'
import { InfoItem } from '@/blocks/InfoItem'
import { Table } from '@/blocks/Table'
import { signPreviewToken } from '@/lib/preview-token'

export const StoreProducts: CollectionConfig = {
  slug: 'store-products',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'updatedAt'],
    preview: async (doc) => {
      if (!doc?.slug) return null
      const token = await signPreviewToken(doc.slug as string, 'store-products')
      const base = process.env.FRONTEND_URL ?? 'http://localhost:4321'
      return `${base}/api/preview/enter?token=${token}`
    },
  },
  access: adminsOnly,
  versions: {
    drafts: true,
  },
  hooks: {
    afterChange: [
      purgeCache((doc) => [`product-${doc.slug}`, 'products']),
    ],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'featuredImage',
      type: 'relationship',
      relationTo: 'media',
      filterOptions: {
        mimeType: { contains: 'image/' },
      },
    },
    mediaGalleryField,
    {
      name: 'infoPanel',
      type: 'blocks',
      blocks: [InfoItem, Table],
    },
  ],
}
