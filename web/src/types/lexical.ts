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
} from '@payloadcms/richtext-lexical'

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
