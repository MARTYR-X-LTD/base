export const SITE_NAME = 'mönk'
export const SITE_DESCRIPTION = 'mönk Creative Studio CMS'

export const MEDIA_TYPES = ['image', 'svg', 'video', '3d'] as const
export type MediaType = (typeof MEDIA_TYPES)[number]
