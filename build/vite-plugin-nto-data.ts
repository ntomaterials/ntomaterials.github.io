/**
 * Vite-плагин: превращает /data/*.csv в виртуальный модуль `virtual:nto-data`.
 *
 * CSV читаются и валидируются один раз на этапе сборки, результат попадает
 * в бандл как обычный JSON-литерал. В рантайме никаких fetch к CSV нет.
 *
 * В dev-режиме правка CSV перезапускает валидацию и перезагружает страницу;
 * ошибка валидации показывается оверлеем Vite, сервер при этом не падает.
 */

import { resolve } from 'node:path';
import type { Plugin } from 'vite';

import {
  DataValidationError,
  MATRIX_FILE,
  PROFILES_FILE,
  QUESTIONS_FILE,
  loadDataset,
} from './data-loader';

const VIRTUAL_ID = 'virtual:nto-data';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

const DATA_FILES = [MATRIX_FILE, QUESTIONS_FILE, PROFILES_FILE] as const;

export interface NtoDataPluginOptions {
  /** Каталог с CSV. По умолчанию — <root>/data. */
  dataDir?: string;
}

function formatFailure(error: unknown): Error {
  if (error instanceof DataValidationError) {
    return new Error(
      `\n\n❌  Проверка данных теста НТО не пройдена\n\n${error.message}\n`,
    );
  }
  return error instanceof Error ? error : new Error(String(error));
}

export function ntoDataPlugin(options: NtoDataPluginOptions = {}): Plugin {
  let dataDir = '';
  let isBuild = false;

  return {
    name: 'nto-data',
    enforce: 'pre',

    configResolved(config) {
      dataDir = options.dataDir ?? resolve(config.root, 'data');
      isBuild = config.command === 'build';
    },

    buildStart() {
      // При сборке падаем как можно раньше — до бандлинга, с понятным текстом.
      if (!isBuild) return;
      try {
        const dataset = loadDataset(dataDir);
        this.info(
          `данные приняты: ${dataset.meta.profileCount} профилей, ` +
            `${dataset.meta.clusterCount} кластеров, ${dataset.meta.activityCount} типов деятельности, ` +
            `${dataset.meta.questionCount} вопросов ` +
            `(блок А — ${dataset.meta.blockAQuestionCount}, блок Б — ${dataset.meta.blockBQuestionCount})`,
        );
      } catch (error) {
        throw formatFailure(error);
      }
    },

    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null;
    },

    load(id) {
      if (id !== RESOLVED_ID) return null;

      for (const file of DATA_FILES) this.addWatchFile(resolve(dataDir, file));

      try {
        return `export default ${JSON.stringify(loadDataset(dataDir))};`;
      } catch (error) {
        throw formatFailure(error);
      }
    },

    handleHotUpdate({ file, server }) {
      const isDataFile = DATA_FILES.some((name) => file === resolve(dataDir, name));
      if (!isDataFile) return;

      const module = server.moduleGraph.getModuleById(RESOLVED_ID);
      if (module) server.moduleGraph.invalidateModule(module);
      server.ws.send({ type: 'full-reload' });
      return [];
    },
  };
}
