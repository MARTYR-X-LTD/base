import type { CollectionConfig } from 'payload'
import { adminsOnly } from '@/lib/access-control'
import { purgeCache } from '@/hooks/purgeCache'

export const Categories: CollectionConfig = {
  slug: 'categories',
  admin: {
    useAsTitle: 'name',
  },
  access: adminsOnly,
  hooks: {
    afterChange: [purgeCache(['categories'])],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        position: 'sidebar',
    },
    },
  ],
}
