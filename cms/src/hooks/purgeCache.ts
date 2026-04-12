import type { CollectionAfterChangeHook } from 'payload'

export const purgeCache = (
  tags: string[] | ((doc: any) => string[])
): CollectionAfterChangeHook => {
  return async ({ doc, req }) => {
    const purgeUrl = process.env.FRONTEND_PURGE_URL
    const purgeSecret = process.env.PURGE_SECRET

    if (!purgeUrl || !purgeSecret) {
      req.payload.logger.warn('Cache purge skipped: missing FRONTEND_PURGE_URL or PURGE_SECRET')
      return doc
    }

    const resolvedTags = typeof tags === 'function' ? tags(doc) : tags

    try {
      await fetch(purgeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${purgeSecret}`,
        },
        body: JSON.stringify({ tags: resolvedTags }),
      })
    } catch (error) {
      req.payload.logger.error(`Cache purge failed: ${error}`)
    }

    return doc
  }
}
