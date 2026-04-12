'use client'

/**
 * Custom cell component for file size field
 * Displays file size in human-readable format (KB or MB)
 */
export const FileSizeCell = ({ cellData }: { cellData: number | null | undefined }) => {
  if (!cellData || cellData === 0) return <span>-</span>

  // Less than 1MB: show in KB
  if (cellData < 1024 * 1024) {
    const kb = (cellData / 1024).toFixed(2)
    return <span>{kb} KB</span>
  }

  // 1MB or more: show in MB
  const mb = (cellData / (1024 * 1024)).toFixed(2)
  return <span>{mb} MB</span>
}
