import {
  S3Client,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3'
import fs from 'fs/promises'
import type { R2StorageConfig } from './types'

/**
 * Delete a single file from R2 storage
 */
export async function deleteFromR2(
  key: string,
  config: R2StorageConfig
): Promise<void> {
  const s3 = new S3Client({
    endpoint: config.endpoint,
    region: 'auto',
    credentials: config.credentials,
  })

  await s3.send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: key,
    })
  )

  console.log(`[AVIF] Deleted from R2: ${key}`)
}

/**
 * Delete multiple files from R2 storage (batch operation)
 */
export async function deleteMultipleFromR2(
  keys: string[],
  config: R2StorageConfig
): Promise<void> {
  if (keys.length === 0) return

  const s3 = new S3Client({
    endpoint: config.endpoint,
    region: 'auto',
    credentials: config.credentials,
  })

  // S3 DeleteObjects supports up to 1000 keys per request
  // For larger batches, split into chunks
  const chunkSize = 1000
  for (let i = 0; i < keys.length; i += chunkSize) {
    const chunk = keys.slice(i, i + chunkSize)

    await s3.send(
      new DeleteObjectsCommand({
        Bucket: config.bucket,
        Delete: {
          Objects: chunk.map((key) => ({ Key: key })),
          Quiet: true, // Don't return success for each deletion
        },
      })
    )

    console.log(`[AVIF] Deleted ${chunk.length} files from R2`)
  }
}

/**
 * Extract R2 keys from variant URLs
 * URL format: https://media.martyr.shop/prod/images/{docId}-{width}w.avif
 * Key format: prod/images/{docId}-{width}w.avif
 *
 * IMPORTANT: Extract the ACTUAL key from the URL pathname, don't reconstruct it.
 * This ensures we delete the correct file even if the prefix config changes.
 */
export function getR2KeysFromVariants(
  variants: Array<{ url: string }>
): string[] {
  return variants.map((variant) => {
    // Extract full pathname from URL
    const url = new URL(variant.url)
    // pathname = '/prod/images/abc123-1200w.avif'
    // Remove leading slash to get R2 key: 'prod/images/abc123-1200w.avif'
    return url.pathname.substring(1)
  })
}

/**
 * Delete temp file from filesystem
 */
export async function deleteTempFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath)
    console.log(`[AVIF] Deleted temp file: ${filePath}`)
  } catch (err) {
    // File might not exist (already deleted or never created)
    // This is not an error - just log for debugging
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`[AVIF] Failed to delete temp file ${filePath}:`, err)
    }
  }
}

/**
 * Clean up orphaned temp files from /tmp
 * Pattern: *-original.* (e.g., abc123-original.jpg)
 */
export async function cleanupOrphanedTempFiles(): Promise<void> {
  try {
    const files = await fs.readdir('/tmp')
    const orphanedFiles = files.filter((file) => /-original\./.test(file))

    for (const file of orphanedFiles) {
      await deleteTempFile(`/tmp/${file}`)
    }

    if (orphanedFiles.length > 0) {
      console.log(`[AVIF] Cleaned up ${orphanedFiles.length} orphaned temp files from /tmp`)
    }
  } catch (err) {
    console.error('[AVIF] Failed to cleanup orphaned temp files:', err)
  }
}

/**
 * List R2 objects with a given prefix
 * Used for finding orphaned R2 files during boot cleanup
 */
export async function listR2Objects(
  prefix: string,
  config: R2StorageConfig,
): Promise<string[]> {
  const s3 = new S3Client({
    endpoint: config.endpoint,
    region: 'auto',
    credentials: config.credentials,
  })

  const command = new ListObjectsV2Command({
    Bucket: config.bucket,
    Prefix: prefix,
  })

  try {
    const response = await s3.send(command)
    return response.Contents?.map((obj) => obj.Key!).filter(Boolean) || []
  } catch (err) {
    console.error(`Failed to list R2 objects with prefix ${prefix}:`, err)
    return []
  }
}
