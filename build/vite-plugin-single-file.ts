/**
 * Vite-плагин: собирает всё в один самодостаточный index.html.
 *
 * JS и CSS встраиваются инлайном, ссылки на манифест, иконку и service worker
 * убираются — получившийся файл можно скачать и открыть с диска без интернета
 * и без веб-сервера.
 *
 * Используется только в режиме `vite build --mode single`.
 */

import type { Plugin } from 'vite';

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function singleFilePlugin(): Plugin {
  return {
    name: 'nto-single-file',
    apply: 'build',
    enforce: 'post',

    generateBundle(_options, bundle) {
      const htmlEntry = Object.values(bundle).find(
        (item) => item.type === 'asset' && item.fileName.endsWith('.html'),
      );
      if (!htmlEntry || htmlEntry.type !== 'asset') return;

      let html = String(htmlEntry.source);

      for (const [fileName, item] of Object.entries(bundle)) {
        if (item === htmlEntry) continue;

        if (item.type === 'chunk') {
          const pattern = new RegExp(
            `<script[^>]*src="[^"]*${escapeForRegExp(fileName)}"[^>]*>\\s*</script>`,
          );
          if (pattern.test(html)) {
            html = html.replace(pattern, () => `<script type="module">\n${item.code}\n</script>`);
            delete bundle[fileName];
          }
        } else if (fileName.endsWith('.css')) {
          const pattern = new RegExp(
            `<link[^>]*href="[^"]*${escapeForRegExp(fileName)}"[^>]*>`,
          );
          if (pattern.test(html)) {
            html = html.replace(pattern, () => `<style>\n${String(item.source)}\n</style>`);
            delete bundle[fileName];
          }
        }
      }

      // Внешние ссылки в офлайн-файле только сломались бы.
      html = html
        .replace(/\s*<link[^>]*rel="manifest"[^>]*>/g, '')
        .replace(/\s*<link[^>]*rel="icon"[^>]*>/g, '')
        .replace(/\s*<link[^>]*rel="modulepreload"[^>]*>/g, '');

      htmlEntry.source = html;
    },
  };
}
