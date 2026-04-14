import type {
  SerializedTextNode,
  SerializedParagraphNode,
  SerializedHeadingNode,
  SerializedListNode,
  SerializedListItemNode,
  SerializedLinkNode,
  SerializedLineBreakNode,
  SerializedQuoteNode,
  SerializedHorizontalRuleNode,
  SerializedUploadNode,
} from '@payloadcms/richtext-lexical'
import type { Media } from '@cms/payload-types'

/**
 * Custom fields added to upload nodes in rich text
 */
export interface MediaUploadFields {
  caption?: string
  maxWidth?: string
  figureMargin?: string
  imgPadding?: string
  customFigureStyle?: string
  customImgStyle?: string
}

/**
 * Upload node with custom fields
 * Fields are in node.fields, media is in node.value
 */
export interface MediaUploadNode extends Omit<SerializedUploadNode, 'value' | 'fields'> {
  type: 'upload'
  relationTo: 'media'
  value: Media | string // Populated Media or just ID string
  fields: MediaUploadFields | null
}

export interface LinkFields {
  url: string
  linkType: 'custom' | 'internal'
  newTab?: boolean
  doc?: {
    relationTo: string
    value: unknown
  } | null
}

export type LexicalNode =
  | SerializedTextNode
  | SerializedParagraphNode
  | SerializedHeadingNode
  | SerializedListNode
  | SerializedListItemNode
  | MediaUploadNode
  | SerializedLinkNode
  | SerializedLineBreakNode
  | SerializedQuoteNode
  | SerializedHorizontalRuleNode

export interface LexicalRoot {
  type: 'root'
  children: LexicalNode[]
  direction?: 'ltr' | 'rtl' | null
  format?: string
  indent?: number
  version?: number
}

export interface LexicalEditorState {
  root: LexicalRoot
}

export const TEXT_FORMAT = {
  BOLD: 1,
  ITALIC: 2,
  STRIKETHROUGH: 4,
  UNDERLINE: 8,
  CODE: 16,
  SUBSCRIPT: 32,
  SUPERSCRIPT: 64,
} as const
