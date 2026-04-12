'use client'
import React from 'react'
import { SaveButton, useDocumentInfo } from '@payloadcms/ui'
import type { SaveButtonClientProps } from 'payload'

/**
 * Custom Save Button that shows "Upload" on create, "Save" on edit
 */
export function UploadSaveButton(props: SaveButtonClientProps) {
  const { id } = useDocumentInfo()

  // If no ID exists, it's a create operation (upload)
  const label = id ? 'Save' : 'Upload'

  return <SaveButton {...props} label={label} />
}
