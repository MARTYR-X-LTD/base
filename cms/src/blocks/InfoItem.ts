import type { Block } from 'payload'
import { liteEditor } from '@/lib/lexical/lite'

export const InfoItem: Block = {
  slug: 'info-item',
  labels: {
    singular: 'Info Item',
    plural: 'Info Items',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'content',
      type: 'richText',
      editor: liteEditor,
    },
    {
      name: 'displayMode',
      type: 'select',
      defaultValue: 'fixed',
      options: [
        { label: 'Fixed', value: 'fixed' },
        { label: 'Collapsible', value: 'collapsible' },
      ],
    },
    {
      name: 'openByDefault',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        condition: (_, siblingData) => siblingData?.displayMode === 'collapsible',
      },
    },
  ],
}
