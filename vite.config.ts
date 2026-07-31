import { defineConfig } from 'vite';

import { answerLogPlugin } from './build/vite-plugin-answer-log';
import { ntoDataPlugin } from './build/vite-plugin-nto-data';
import { serviceWorkerPlugin } from './build/vite-plugin-service-worker';
import { singleFilePlugin } from './build/vite-plugin-single-file';

export default defineConfig(({ mode }) => {
  const single = mode === 'single';

  return {
    // Относительный base — сайт одинаково работает и в корне домена,
    // и в подкаталоге (GitHub Pages: https://user.github.io/repo/).
    base: './',

    plugins: [
      ntoDataPlugin(),
      answerLogPlugin(),
      single ? singleFilePlugin() : serviceWorkerPlugin(),
    ],

    define: {
      __SINGLE_FILE__: JSON.stringify(single),
    },

    build: {
      outDir: single ? 'dist-single' : 'dist',
      emptyOutDir: true,
      target: 'es2020',
      cssCodeSplit: !single,
      // В однофайловой сборке всё встраивается инлайном.
      assetsInlineLimit: single ? Number.MAX_SAFE_INTEGER : 4096,
      modulePreload: single ? false : { polyfill: false },
      rollupOptions: single ? { output: { inlineDynamicImports: true } } : {},
      reportCompressedSize: false,
    },

    server: {
      // Чтобы тест можно было проверить внутри iframe с локального стенда.
      cors: true,
    },
  };
});
