import type { Field } from 'payload'
import { singleMediaBlock } from './blocks'

export const mediaGalleryField: Field = {
  name: 'mediaGallery',
  type: 'group',
  admin: {
    description: 'Product page media gallery',
  },
  fields: [
    {
      name: 'items',
      type: 'blocks',
      label: 'Media Items',
      blocks: [singleMediaBlock],
      admin: {
        description: 'Drag to reorder.',
      },
    },
  ],
}
