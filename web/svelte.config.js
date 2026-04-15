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
            api: "modern-compiler",
            additionalData: `@use "/src/styles/mixins" as *; @use "/src/styles/vars" as *;`,
          },
        },
      },
    },
  }),
}
