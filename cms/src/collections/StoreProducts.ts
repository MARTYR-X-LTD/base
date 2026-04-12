import type { CollectionConfig } from 'payload'
import { adminsOnly } from '@/lib/access-control'
import { purgeCache } from '@/hooks/purgeCache'
import { mediaGalleryField } from '@/fields/mediaGallery'
import { InfoItem } from '@/blocks/InfoItem'
import { Table } from '@/blocks/Table'

export const StoreProducts: CollectionConfig = {
  slug: 'store-products',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'updatedAt'],
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
        mediaType: { equals: 'image' },
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
