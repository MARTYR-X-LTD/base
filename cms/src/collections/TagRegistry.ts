import type { CollectionConfig } from 'payload'
import { adminsOnly } from '@/lib/access-control'

export const TagRegistry: CollectionConfig = {
  slug: 'tag-registry',
  admin: {
    useAsTitle: 'label',
    defaultColumns: ['label'],
  },
  access: adminsOnly,
  fields: [
    {
      name: 'label',
      type: 'text',
      required: true,
      unique: true,
    },
  ],
}
