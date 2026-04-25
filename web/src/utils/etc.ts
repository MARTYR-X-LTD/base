/**
 * Converts text to a URL-friendly slug
 */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Recursively extracts plain text from Lexical nodes
 */
interface LexicalTextNode {
  type?: string
  text?: string
  children?: LexicalTextNode[]
}

export function extractLexicalText(nodes: LexicalTextNode[]): string {
  if (!nodes || !Array.isArray(nodes)) return ''

  return nodes
    .map((node) => {
      if (node.type === 'text') return node.text || ''
      if (node.children) return extractLexicalText(node.children)
      return ''
    })
    .join('')
}
