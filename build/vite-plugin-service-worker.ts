/**
 * Vite-плагин: генерирует service worker для офлайн-режима.
 *
 * Список файлов берётся из готового бандла, поэтому его не нужно поддерживать
 * руками. Имя кэша выводится из хешей имён файлов: новая сборка — новый кэш,
 * старые кэши удаляются при активации.
 *
 * Стратегия: документ — «сначала сеть» (обновления доезжают сразу, офлайн
 * работает из кэша), остальные ресурсы — «сначала кэш» (они версионированы
 * по содержимому, поэтому устареть не могут).
 */

import type { Plugin } from 'vite';

/** Короткий детерминированный хеш (FNV-1a) — только для имени кэша. */
function fingerprint(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

function renderServiceWorker(cacheName: string, urls: readonly string[]): string {
  return `// Сгенерировано автоматически (build/vite-plugin-service-worker.ts). Не редактировать.
const CACHE = ${JSON.stringify(cacheName)};
const ASSETS = ${JSON.stringify(urls, null, 2)};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./').then((cached) => cached || caches.match(request))),
    );
    return;
  }

  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
`;
}

export function serviceWorkerPlugin(): Plugin {
  return {
    name: 'nto-service-worker',
    apply: 'build',

    generateBundle(_options, bundle) {
      const assets = Object.keys(bundle)
        .filter((name) => !name.endsWith('.map') && name !== 'sw.js')
        .sort();

      // './' — это сам документ; кэшируем его отдельно от index.html,
      // чтобы навигация работала и по адресу каталога, и по имени файла.
      const urls = ['./', ...assets.map((name) => `./${name}`)];
      const cacheName = `nto-test-${fingerprint(assets.join('|'))}`;

      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: renderServiceWorker(cacheName, urls),
      });
    },
  };
}
