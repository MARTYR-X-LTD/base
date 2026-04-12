'use client'

import { useField } from '@payloadcms/ui'

/**
 * Custom field component for URL fields
 * Displays URL as a clickable link in a read-only text field
 */
export const UrlLinkField = () => {
  const { value } = useField<string>()

  if (!value) {
    return <div style={{ color: 'var(--theme-elevation-500)' }}>No URL</div>
  }

  return (
    <div className="field-type text read-only">
      <label className="field-label">URL</label>
      <div className="field-type__wrap">
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block',
            padding: '0.75rem',
            backgroundColor: 'var(--theme-elevation-50)',
            border: '1px solid var(--theme-elevation-200)',
            borderRadius: '4px',
            color: 'var(--theme-elevation-800)',
            textDecoration: 'none',
            wordBreak: 'break-all',
            fontSize: '0.875rem',
          }}
        >
          {value}
        </a>
      </div>
    </div>
  )
}
