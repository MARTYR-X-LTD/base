'use client'

/**
 * Custom cell component for ID field
 * Displays just the ID value without "ID: " prefix
 */
export const IdCell = ({ cellData }: { cellData: string }) => {
  return <span>{cellData}</span>
}
