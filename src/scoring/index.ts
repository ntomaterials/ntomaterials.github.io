/**
 * Точка входа модуля расчёта.
 *
 * Здесь и только здесь выбирается активная методика. Чтобы переключить тест
 * на другую формулу, поменяйте значение ACTIVE_STRATEGY_ID — всё остальное
 * (загрузка данных, интерфейс, тексты) останется прежним.
 */

import type { Dataset } from '../types';
import { euclideanStrategy } from './euclidean';
import type { Answers } from './user-vector';
import { buildUserVector } from './user-vector';
import type { ScoringStrategy, TestResult } from './types';
import { weightedAverageStrategy } from './weighted-average';

/** Все доступные методики расчёта. */
export const STRATEGIES: readonly ScoringStrategy[] = [
  euclideanStrategy,
  weightedAverageStrategy,
];

/**
 * Активная методика.
 *
 * 'euclidean'         — взвешенное евклидово расстояние (методика по умолчанию);
 * 'weighted-average'  — средневзвешенный балл SCORE = (4·S_A + 2·S_B) / 6.
 */
export const ACTIVE_STRATEGY_ID = 'euclidean';

export function getStrategy(id: string = ACTIVE_STRATEGY_ID): ScoringStrategy {
  const strategy = STRATEGIES.find((item) => item.id === id);
  if (!strategy) throw new Error(`Неизвестная методика расчёта: «${id}»`);
  return strategy;
}

/** Полный расчёт результата по ответам участника. */
export function evaluateAnswers(
  answers: Answers,
  dataset: Dataset,
  strategyId: string = ACTIVE_STRATEGY_ID,
): TestResult {
  return getStrategy(strategyId).evaluate(buildUserVector(answers, dataset), dataset);
}

export { buildUserVector, toNormalizedScore } from './user-vector';
export type { Answers } from './user-vector';
export type {
  ComponentHighlight,
  ProfileResult,
  ScoringStrategy,
  TestResult,
} from './types';
export { cautionText } from './messages';
