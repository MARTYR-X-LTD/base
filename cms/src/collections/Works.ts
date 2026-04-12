import type { CollectionConfig } from 'payload'
import { adminsOnly } from '@/lib/access-control'
import { purgeCache } from '@/hooks/purgeCache'
import { mediaGalleryField } from '@/fields/mediaGallery'
import { InfoItem } from '@/blocks/InfoItem'
import { Table } from '@/blocks/Table'

export const Works: CollectionConfig = {
  slug: 'works',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'updatedAt'],
  },
  access: adminsOnly,
  versions: {
    drafts: true,
  },
  hooks: {
    afterChange: [
      purgeCache((doc) => [`work-${doc.slug}`, 'works']),
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
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
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
