/**
 * Шаг сбора ответов и построения вектора пользователя.
 *
 * Эта часть общая для всех стратегий расчёта, поэтому вынесена отдельно от них.
 */

import type { Answer, Dataset } from '../types';
import { SCALE_MAX } from './constants';

/** Ответы участника: идентификатор вопроса → балл. */
export type Answers = Readonly<Record<string, Answer>>;

/** Значение компоненты для нейтрального балла — запасной вариант. */
const NEUTRAL = SCALE_MAX / 2;

/**
 * Вектор пользователя U: по одной компоненте на каждую строку матрицы.
 *
 * Ответы уже даны в шкале [0 .. 3] — той же, в которой живут веса матрицы,
 * поэтому дополнительная нормализация не нужна: значение компоненты —
 * это просто среднее ответов по всем вопросам, относящимся к этой строке.
 * Сколько вопросов приходится на компоненту (два, один или пять) определяется
 * банком вопросов, а не кодом.
 *
 * Интерфейс не пускает участника дальше без ответа, поэтому пропусков быть
 * не должно; если ответа всё же нет, компонента берётся нейтральной.
 */
export function buildUserVector(answers: Answers, dataset: Dataset): number[] {
  const size = dataset.components.length;
  const sums = new Array<number>(size).fill(0);
  const counts = new Array<number>(size).fill(0);

  for (const question of dataset.questions) {
    const answer = answers[question.id];
    if (answer === undefined) continue;
    sums[question.componentIndex] += answer;
    counts[question.componentIndex] += 1;
  }

  return sums.map((sum, index) => (counts[index] > 0 ? sum / counts[index] : NEUTRAL));
}

/** Приводит компоненту вектора пользователя из [0 .. 3] в [0 .. 1]. */
export function toNormalizedScore(componentValue: number): number {
  return componentValue / SCALE_MAX;
}
