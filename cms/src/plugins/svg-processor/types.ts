export interface SvgProcessorOptions {
  validation: {
    maxFileSizeMB: number // 0.5 MB (500KB) recommended
  }

  storage: {
    bucket: string // R2 bucket name
    prefix: string // 'prod/svg' or 'test/svg'
    endpoint: string // R2 S3-compatible endpoint
    credentials: {
      accessKeyId: string
      secretAccessKey: string
    }
    publicUrl: string // Custom domain (https://media.martyr.shop)
  }
}

export interface SvgDimensions {
  width: number | null
  height: number | null
}
