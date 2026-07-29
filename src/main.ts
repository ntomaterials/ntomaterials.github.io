/**
 * Точка входа.
 *
 * Данные приходят из виртуального модуля `virtual:nto-data`, который
 * Vite-плагин собирает из /data/*.csv на этапе сборки. В рантайме
 * ни одного сетевого запроса за данными нет.
 */

import dataset from 'virtual:nto-data';

import './styles/main.css';
import { createApp } from './ui/app';

const root = document.getElementById('app');
if (!root) {
  throw new Error('Не найден контейнер #app — проверьте index.html');
}

createApp(root, dataset);

// Офлайн-режим: service worker регистрируется только в собранном сайте.
// В однофайловой сборке он не нужен — там и так всё внутри одного файла.
if (
  !__SINGLE_FILE__ &&
  import.meta.env.PROD &&
  'serviceWorker' in navigator &&
  location.protocol.startsWith('http')
) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js').catch(() => {
      // Офлайн-режим — приятное дополнение: без него тест работает как обычно.
    });
  });
}
