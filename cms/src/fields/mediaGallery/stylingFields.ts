import type { Field } from 'payload'

export const sharedStylingFields: Field[] = [
  {
    type: 'row',
    fields: [
      {
        name: 'width',
        label: 'Width (desktop)',
        type: 'select',
        defaultValue: 'full',
        options: [
          { label: 'Full', value: 'full' },
          { label: 'Half', value: 'half' },
          { label: 'Quarter', value: 'quarter' },
          { label: 'Third', value: 'third' },
        ],
        admin: {
          width: '50%',
        },
      },
      {
        name: 'display',
        type: 'select',
        defaultValue: 'all',
        options: [
          { label: 'All Viewports', value: 'all' },
          { label: 'Desktop Only', value: 'desktop' },
          { label: 'Mobile Only', value: 'mobile' },
        ],
        admin: {
          width: '50%',
        },
      },
    ],
  },
  {
    type: 'row',
    fields: [
      {
        name: 'padding',
        type: 'text',
        admin: {
          placeholder: '3%, 1.5rem',
          description: 'CSS padding on container element',
          width: '20%',
        },
      },
      {
        name: 'customClasses',
        type: 'text',
        admin: {
          placeholder: 'e.g., filter-1 jd-blend-exclusion',
          description: 'Extra CSS classes on container',
          width: '40%',
        },
      },
      {
        name: 'customStyle',
        type: 'text',
        admin: {
          placeholder: 'e.g., width: max(42rem, 29%)',
          description: 'Inline CSS on inner wrapper',
          width: '40%',
        },
      },
    ],
  },
]
