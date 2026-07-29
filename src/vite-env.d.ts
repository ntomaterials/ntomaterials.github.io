/// <reference types="vite/client" />

/**
 * Данные теста, собранные из /data/*.csv на этапе сборки.
 * Модуль виртуальный — его отдаёт плагин build/vite-plugin-nto-data.ts.
 */
declare module 'virtual:nto-data' {
  import type { Dataset } from './types';
  const dataset: Dataset;
  export default dataset;
}

/** true в сборке `npm run build:single` (один самодостаточный .html). */
declare const __SINGLE_FILE__: boolean;
