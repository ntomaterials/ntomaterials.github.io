/**
 * Дев-режим: отправляет ответы участника на локальный dev-сервер, который
 * пишет их в файл каталога /log (см. build/vite-plugin-answer-log.ts).
 *
 * Работает только когда `import.meta.env.DEV` истинно, то есть при `npm run dev`.
 * В сборке (`npm run build`) это условие статически ложно, Rollup выбрасывает
 * ветку целиком — в проде ни этого кода, ни сетевых запросов не остаётся.
 */

const ENDPOINT = '/__nto-answer-log';

export interface AnswerLogger {
  /** Отмечает момент открытия теста — вызывать один раз при переходе к первому вопросу. */
  markStarted(): void;
  /** Отправляет баллы за уже данные ответы, по порядку вопросов. */
  record(scores: readonly number[]): void;
}

export function createAnswerLogger(): AnswerLogger {
  let startedAt: string | null = null;

  return {
    markStarted(): void {
      if (!import.meta.env.DEV) return;
      startedAt = new Date().toISOString();
    },

    record(scores: readonly number[]): void {
      if (!import.meta.env.DEV || startedAt === null) return;
      void fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startedAt, scores }),
      }).catch(() => {
        // Лог — удобство для разработки, а не критичная функциональность теста.
      });
    },
  };
}
