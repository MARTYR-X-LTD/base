// cms/src/instrumentation.ts
import type { Payload } from 'payload'
import fs from 'fs/promises'
import {
  deleteTempFile,
  deleteMultipleFromR2,
  listR2Objects,
} from './plugins/media-processor/cleanup'
import { getR2Config } from './lib/r2-config'

export async function onInit(payload: Payload) {
  payload.logger.info('[Boot] Running boot-time cleanup...')

  // Fire-and-forget — don't block server startup
  ;(async () => {
    try {
      const imageStorage = getR2Config('images')
      const videoStorage = getR2Config('videos')

      // ── STEP 1: Find all temp files from previous uploads ──────────────────
      const tmpFiles = await fs.readdir('/tmp').catch(() => [] as string[])
      const originalFiles = tmpFiles.filter((f) => /-original\./.test(f))
      const tempDocIds = originalFiles.map((f) => f.split('-original.')[0])

      payload.logger.info(`[Boot] Found ${tempDocIds.length} temp files from previous uploads`)

      // ── STEP 2: For each temp file, check if the document exists ───────────
      for (const docId of tempDocIds) {
        try {
          await payload.findByID({ collection: 'media', id: docId, overrideAccess: true })

          // Document exists → upload completed, temp file is leftover
          payload.logger.info(`[Boot] Doc ${docId} exists, removing orphaned temp file`)
          await deleteTempFile(`/tmp/${docId}-original.*`)
        } catch (err: unknown) {
          const status = typeof err === 'object' && err !== null && 'status' in err
            ? (err as { status: number }).status
            : null

          if (status === 404) {
            // Document doesn't exist → server crashed mid-upload, clean up R2 too
            payload.logger.info(`[Boot] Doc ${docId} not found — checking R2 for partial uploads`)

            const orphanedKeys: string[] = []

            const imageKeys = await listR2Objects(`${imageStorage.prefix}/${docId}-`, imageStorage)
            const videoKeys = await listR2Objects(`${videoStorage.prefix}/${docId}-`, videoStorage)
            orphanedKeys.push(...imageKeys, ...videoKeys)

            if (orphanedKeys.length > 0) {
              payload.logger.info(`[Boot] Deleting ${orphanedKeys.length} orphaned R2 files for ${docId}`)
              await deleteMultipleFromR2(imageKeys, imageStorage)
              await deleteMultipleFromR2(videoKeys, videoStorage)
            }

            await deleteTempFile(`/tmp/${docId}-original.*`)
          } else {
            payload.logger.error(`[Boot] Error checking doc ${docId}: ${err}`)
          }
        }
      }

      // ── STEP 3: Clean up leftover avifenc temp files ───────────────────────
      const avifencFiles = tmpFiles.filter(
        (f) =>
          (/\.avif$/.test(f) || /\.png$/.test(f)) &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(f),
      )
      for (const file of avifencFiles) {
        await fs.unlink(`/tmp/${file}`).catch(() => {})
      }
      if (avifencFiles.length > 0) {
        payload.logger.info(`[Boot] Cleaned up ${avifencFiles.length} avifenc temp files`)
      }

      payload.logger.info('[Boot] Cleanup complete')
    } catch (err) {
      payload.logger.error(`[Boot] Cleanup failed: ${err}`)
    }
  })()
}
