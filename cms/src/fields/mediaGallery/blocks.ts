import type { Block } from 'payload'
import { sharedStylingFields } from './stylingFields'

export const singleMediaBlock: Block = {
  slug: 'singleMedia',
  labels: { singular: 'Single Media', plural: 'Single Media' },
  fields: [
    {
      name: 'media',
      type: 'upload',
      relationTo: 'media',
      required: true,
      filterOptions: {
        // Allow images and videos — exclude SVGs
        mimeType: { not_equals: 'image/svg+xml' },
      },
    },
    ...sharedStylingFields,
  ],
}
