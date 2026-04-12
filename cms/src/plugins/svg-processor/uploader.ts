import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import type { SvgProcessorOptions } from './types'

/**
 * Upload SVG file to R2 storage
 * Returns the public URL
 */
export async function uploadSvgToR2(
  buffer: Buffer,
  key: string,
  config: SvgProcessorOptions['storage'],
): Promise<string> {
  const s3 = new S3Client({
    endpoint: config.endpoint,
    region: 'auto',
    credentials: config.credentials,
  })

  await s3.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: buffer,
      ContentType: 'image/svg+xml',
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )

  // Return public URL
  // key = 'prod/svg/abc123.svg'
  return `${config.publicUrl}/${key}`
}
