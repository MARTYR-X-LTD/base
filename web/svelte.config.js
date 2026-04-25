import { fileURLToPath } from "node:url"
import { vitePreprocess } from "@astrojs/svelte"

export default {
  extensions: [".svelte"],
  compilerOptions: {
    experimental: {
      async: true,
    },
  },
  preprocess: vitePreprocess({
    style: {
      css: {
        preprocessorOptions: {
          scss: {
            additionalData: `@use "mixins" as *; @use "vars" as *;`,
            loadPaths: [fileURLToPath(new URL('./src/styles', import.meta.url))],
          },
        },
      },
    },
  }),
}
