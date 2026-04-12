'use client'

import React from 'react'
import { FieldLabel, useField } from '@payloadcms/ui'
import type { NumberFieldClientComponent } from 'payload'

/**
 * Custom Number Field component that displays file size in human-readable format
 * Follows PayloadCMS v3 UI patterns using FieldLabel and useField hook
 *
 * Note: The underlying field in the schema is type: 'number' storing bytes.
 * This component only affects admin UI display, not API responses or database storage.
 */
export const FileSizeNumberField: NumberFieldClientComponent = (props) => {
  const { path, field } = props
  const { value, showError, errorMessage } = useField<number>({ path })

  // Format bytes to human-readable string
  const displayValue = React.useMemo(() => {
    if (!value || value === 0) return '-'

    if (value < 1024 * 1024) {
      const kb = (value / 1024).toFixed(2)
      return `${kb} KB`
    }

    const mb = (value / (1024 * 1024)).toFixed(2)
    return `${mb} MB`
  }, [value])

  // Build classes following PayloadCMS pattern
  const classes = ['field-type', 'text', 'read-only', showError && 'error']
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes} style={{ '--field-width': field.admin?.width } as React.CSSProperties}>
      <FieldLabel
        label={field.label || field.name}
        path={path}
        required={field.required}
      />
      <div className="field-type__wrap">
        <input
          disabled
          id={`field-${path.replace(/\./g, '__')}`}
          type="text"
          name={path}
          value={displayValue}
          readOnly
        />
      </div>
      {showError && errorMessage && (
        <div className="field-error">{errorMessage}</div>
      )}
    </div>
  )
}
