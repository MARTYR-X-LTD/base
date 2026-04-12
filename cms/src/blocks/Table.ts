import type { Block } from 'payload'
import { liteEditor } from '@/lib/lexical/lite'

export const Table: Block = {
  slug: 'table',
  labels: {
    singular: 'Table',
    plural: 'Tables',
  },
  fields: [
    {
      name: 'rows',
      type: 'array',
      fields: [
        {
          name: 'label',
          type: 'text',
          required: true,
        },
        {
          name: 'value',
          type: 'richText',
          editor: liteEditor,
        },
      ],
    },
  ],
}
