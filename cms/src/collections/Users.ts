import type { CollectionConfig } from 'payload'
import { isAdmin, isAuthenticated } from '@/lib/access-control'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    useAPIKey: true,
  },
  admin: {
    useAsTitle: 'email',
  },
  access: {
    create: isAdmin,
    read: isAuthenticated,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'api-key',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'API Key (Read Only)', value: 'api-key' },
      ],
    },
  ],
}
