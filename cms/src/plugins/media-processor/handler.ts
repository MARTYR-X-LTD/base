import type { PayloadRequest, TypeWithID } from 'payload'

/**
 * Minimal file handler to prevent Payload from trying to read from disk
 *
 * Since we use disableLocalStorage and all files are in R2, we redirect to R2 URLs
 */
export const createFileHandler = () => {
  return async (
    _req: PayloadRequest,
    { doc }: { doc: TypeWithID }
  ): Promise<Response> => {
    // File is always ready (or doesn't exist)
    const mediaDoc = doc as TypeWithID & { url?: string }
    if (!mediaDoc || !mediaDoc.url) {
      return new Response('File not found', { status: 404 })
    }

    // Redirect to R2 URL
    return Response.redirect(mediaDoc.url, 302)
  }
}
