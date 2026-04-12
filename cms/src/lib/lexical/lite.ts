import {
  lexicalEditor,
  BoldFeature,
  ItalicFeature,
  LinkFeature,
} from '@payloadcms/richtext-lexical'

export const liteEditor = lexicalEditor({
  features: [
    BoldFeature(),
    ItalicFeature(),
    LinkFeature(),
  ],
})
