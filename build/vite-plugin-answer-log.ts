/**
 * Vite-плагин: пишет ответы участника в файл каталога /log — только на
 * локальном dev-сервере (`npm run dev`), чтобы можно было посмотреть, как
 * проходят тест во время разработки.
 *
 * `apply: 'serve'` — плагин не подключается при `vite build`, поэтому в
 * собранном сайте нет ни этого эндпоинта, ни записи на диск: раздел 6 ТЗ
 * («ответы никуда не отправляются и нигде не сохраняются») в проде не нарушается.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

export const ANSWER_LOG_ENDPOINT = '/__nto-answer-log';

interface AnswerLogPayload {
  /** ISO-время открытия теста участником. */
  readonly startedAt: string;
  /** Баллы за ответы в порядке вопросов: 3, 2, 1, 0, … */
  readonly scores: readonly number[];
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** «2026.07.30 09:23:00» — по местному времени машины, на которой идёт разработка. */
function formatTimestamp(date: Date): string {
  const datePart = `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
  const timePart = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return `${datePart} ${timePart}`;
}

/** Имя файла: то же время, но без символов, недопустимых в путях Windows. */
function formatFileName(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_` +
    `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}.log`
  );
}

function isAnswerLogPayload(value: unknown): value is AnswerLogPayload {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.startedAt === 'string' &&
    Array.isArray(candidate.scores) &&
    candidate.scores.every((score) => typeof score === 'number')
  );
}

export function answerLogPlugin(): Plugin {
  let logDir = '';

  return {
    name: 'nto-answer-log',
    apply: 'serve',

    configResolved(config) {
      logDir = resolve(config.root, 'log');
    },

    configureServer(server) {
      server.middlewares.use(ANSWER_LOG_ENDPOINT, (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }

        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => {
          try {
            const payload: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            if (!isAnswerLogPayload(payload)) throw new Error('некорректный формат лога');

            const startedAt = new Date(payload.startedAt);
            mkdirSync(logDir, { recursive: true });
            writeFileSync(
              resolve(logDir, formatFileName(startedAt)),
              `${formatTimestamp(startedAt)}\n${payload.scores.join(' ')}\n`,
              'utf8',
            );
            res.statusCode = 204;
          } catch (error) {
            server.config.logger.warn(`[nto-answer-log] ${(error as Error).message}`);
            res.statusCode = 400;
          }
          res.end();
        });
      });
    },
  };
}
