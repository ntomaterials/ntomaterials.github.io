/**
 * Основная методика: взвешенное евклидово расстояние между вектором участника
 * и вектором профиля (шаги 4–9 ТЗ).
 *
 * Шаги 5 и 6 — `componentWeights()` и `weightedEuclideanDistance()` — намеренно
 * оформлены как самостоятельные чистые функции без знания о Dataset и UI.
 * Чтобы поменять метрику (например, на косинусную близость), достаточно
 * заменить их и `distanceToMatchPercent()`; остальной код не меняется.
 */

import type { Dataset } from '../types';
import {
  EUCLIDEAN_GAP_THRESHOLD,
  LOW_ENGAGEMENT_PERCENT,
  SCALE_MAX,
  TOP_N,
  TOP_STRENGTHS,
} from './constants';
import { WARNING_CLOSE_SCORES, WARNING_LOW_ENGAGEMENT } from './messages';
import { clampPercent, dominantActivity, findCautions, highlight, sum } from './shared';
import type { ProfileResult, ScoringStrategy, TestResult } from './types';

/**
 * Шаг 5. Веса компонент вектора профиля: w_i[p] = P_i[p] / Σ P_j[p].
 *
 * Компоненты с нулевым весом профиля не влияют на расстояние — расхождение
 * участника по теме, не связанной с профилем, не штрафуется.
 *
 * @returns null, если у профиля нет ни одного ненулевого веса
 *          (тогда расстояние считается бесконечным и профиль исключается).
 */
export function componentWeights(profileVector: readonly number[]): number[] | null {
  const norm = sum(profileVector);
  if (norm <= 0) return null;
  return profileVector.map((value) => value / norm);
}

/**
 * Шаг 6 (по компонентам). Вклад каждой компоненты в квадрат расстояния:
 * w_i × (U_i − P_i)². Для компонент с P_i = 0 вклад равен нулю.
 *
 * Массив вкладов используется дальше для блока «почему подходит».
 */
export function componentContributions(
  userVector: readonly number[],
  profileVector: readonly number[],
  weights: readonly number[],
): number[] {
  return profileVector.map((profileValue, index) => {
    if (profileValue <= 0) return 0;
    const diff = userVector[index] - profileValue;
    return weights[index] * diff * diff;
  });
}

/**
 * Шаг 6. Взвешенное евклидово расстояние D(U, p) = √( Σ w_i × (U_i − P_i)² ).
 *
 * Диапазон: [0 .. 3]. 0 — идеальное совпадение по всем значимым для профиля
 * темам, 3 — максимальное расхождение.
 */
export function weightedEuclideanDistance(
  userVector: readonly number[],
  profileVector: readonly number[],
): number {
  const weights = componentWeights(profileVector);
  if (weights === null) return Number.POSITIVE_INFINITY;
  return Math.sqrt(sum(componentContributions(userVector, profileVector, weights)));
}

/** Шаг 7. Перевод расстояния в процент совпадения: round((1 − D / 3) × 100). */
export function distanceToMatchPercent(distance: number): number {
  if (!Number.isFinite(distance)) return 0;
  return Math.round(clampPercent((1 - distance / SCALE_MAX) * 100));
}

const ID = 'euclidean';
const TITLE = 'Взвешенное евклидово расстояние';

export const euclideanStrategy: ScoringStrategy = {
  id: ID,
  title: TITLE,
  description:
    'Ответы и веса профиля приводятся к одной шкале 0–3, затем считается расстояние ' +
    'между вектором участника и вектором профиля. Чем ближе вектора, тем выше процент совпадения.',

  evaluate(userVector: readonly number[], dataset: Dataset): TestResult {
    const results: ProfileResult[] = dataset.profiles.map((profile, profileIndex) => {
      const weights = componentWeights(profile.vector);
      const contributions =
        weights === null ? null : componentContributions(userVector, profile.vector, weights);
      const distance =
        contributions === null ? Number.POSITIVE_INFINITY : Math.sqrt(sum(contributions));

      // «Почему подходит»: темы с наименьшим взвешенным вкладом в расстояние,
      // то есть те, по которым участник ближе всего к требованиям профиля.
      // Учитываем только значимые для профиля темы: у компонент с весом 0
      // вклад тождественно нулевой и ничего не означает.
      const strengths = dataset.components
        .filter((component) => profile.vector[component.index] > 0)
        .sort((a, b) => {
          const byContribution =
            (contributions?.[a.index] ?? 0) - (contributions?.[b.index] ?? 0);
          if (byContribution !== 0) return byContribution;
          // При равном вкладе вперёд выходит более «ядровая» для профиля тема.
          return profile.vector[b.index] - profile.vector[a.index] || a.index - b.index;
        })
        .slice(0, TOP_STRENGTHS)
        .map((component) => highlight(component, profile, userVector));

      return {
        profileIndex,
        code: profile.code,
        fullName: profile.fullName,
        metric: distance,
        matchPercent: distanceToMatchPercent(distance),
        strengths,
        dominantActivity: dominantActivity(profile, dataset),
        cautions: findCautions(profile, dataset, userVector),
      };
    });

    // Шаг 7: сортировка по возрастанию расстояния. Исключённые профили
    // (расстояние = +∞) естественным образом оказываются в конце.
    const ranked = [...results].sort((a, b) => a.metric - b.metric || a.code.localeCompare(b.code, 'ru'));

    return {
      strategyId: ID,
      strategyTitle: TITLE,
      userVector,
      ranked,
      top: ranked.slice(0, TOP_N),
      warnings: reliabilityWarnings(ranked),
    };
  },
};

/** Шаг 8. Проверки надёжности результата. */
function reliabilityWarnings(ranked: readonly ProfileResult[]): string[] {
  const warnings: string[] = [];
  const [first, second] = ranked;
  if (!first) return warnings;

  if (second && Number.isFinite(first.metric) && Number.isFinite(second.metric)) {
    const gap = second.metric - first.metric;
    if (gap < EUCLIDEAN_GAP_THRESHOLD) warnings.push(WARNING_CLOSE_SCORES);
  }
  if (first.matchPercent < LOW_ENGAGEMENT_PERCENT) warnings.push(WARNING_LOW_ENGAGEMENT);

  return warnings;
}
