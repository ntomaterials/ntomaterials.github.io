/**
 * Альтернативная методика: средневзвешенный балл по двум осям
 * (первый вариант раздела 4 ТЗ).
 *
 * S_A(p) = Σ W_A[i][p] × score_A[i] / Σ W_A[i][p]   (только где W > 0)
 * S_B(p) = Σ W_B[i][p] × score_B[i] / Σ W_B[i][p]   (только где W > 0)
 * SCORE(p) = (4 × S_A(p) + 2 × S_B(p)) / 6          → [0 .. 1]
 *
 * Здесь score[i] — балл участника по компоненте, приведённый к [0 .. 1]
 * (то есть U_i / 3). Ранжирование — по убыванию SCORE.
 *
 * По умолчанию не используется: активная стратегия задаётся в
 * src/scoring/index.ts. Файл существует, чтобы методику можно было
 * переключить без правки остального кода.
 */

import type { Block, Component, Dataset, Profile } from '../types';
import {
  LOW_ENGAGEMENT_PERCENT,
  TOP_N,
  TOP_STRENGTHS,
  WEIGHTED_AVERAGE_GAP_THRESHOLD,
  WEIGHT_AXIS_A,
  WEIGHT_AXIS_B,
} from './constants';
import { WARNING_CLOSE_SCORES, WARNING_LOW_ENGAGEMENT } from './messages';
import { clampPercent, dominantActivity, findCautions, highlight } from './shared';
import type { ProfileResult, ScoringStrategy, TestResult } from './types';
import { toNormalizedScore } from './user-vector';

/**
 * Балл профиля по одной оси: взвешенное среднее баллов участника по строкам
 * блока, где вес профиля больше нуля. Если таких строк нет — 0.
 */
export function axisScore(
  profile: Profile,
  dataset: Dataset,
  userVector: readonly number[],
  block: Block,
): number {
  let numerator = 0;
  let denominator = 0;
  for (const component of dataset.components) {
    if (component.block !== block) continue;
    const weight = profile.vector[component.index];
    if (weight <= 0) continue;
    numerator += weight * toNormalizedScore(userVector[component.index]);
    denominator += weight;
  }
  return denominator === 0 ? 0 : numerator / denominator;
}

/** Итоговый балл профиля: SCORE(p) = (4 × S_A + 2 × S_B) / 6, диапазон [0 .. 1]. */
export function profileScore(
  profile: Profile,
  dataset: Dataset,
  userVector: readonly number[],
): number {
  const scoreA = axisScore(profile, dataset, userVector, 'A');
  const scoreB = axisScore(profile, dataset, userVector, 'B');
  return (WEIGHT_AXIS_A * scoreA + WEIGHT_AXIS_B * scoreB) / (WEIGHT_AXIS_A + WEIGHT_AXIS_B);
}

const ID = 'weighted-average';
const TITLE = 'Средневзвешенный балл по двум осям';

export const weightedAverageStrategy: ScoringStrategy = {
  id: ID,
  title: TITLE,
  description:
    'Отдельно считается предметный балл (кластеры) и деятельностный балл (типы деятельности), ' +
    'затем они складываются с весами 4/6 и 2/6. Процент совпадения — это итоговый балл.',

  evaluate(userVector: readonly number[], dataset: Dataset): TestResult {
    const results: ProfileResult[] = dataset.profiles.map((profile, profileIndex) => {
      const score = profileScore(profile, dataset, userVector);

      // «Почему подходит»: кластеры блока А с наибольшим вкладом W × score.
      const strengths = dataset.components
        .filter((component) => component.block === 'A' && profile.vector[component.index] > 0)
        .sort((a, b) => {
          const contribution = (component: Component): number =>
            profile.vector[component.index] * toNormalizedScore(userVector[component.index]);
          return contribution(b) - contribution(a) || a.index - b.index;
        })
        .slice(0, TOP_STRENGTHS)
        .map((component) => highlight(component, profile, userVector));

      return {
        profileIndex,
        code: profile.code,
        fullName: profile.fullName,
        metric: score,
        matchPercent: Math.round(clampPercent(score * 100)),
        strengths,
        dominantActivity: dominantActivity(profile, dataset),
        // Эта методика формулирует предупреждение через кластеры блока А.
        cautions: findCautions(profile, dataset, userVector, ['A']),
      };
    });

    // Ранжирование по убыванию балла.
    const ranked = [...results].sort(
      (a, b) => b.metric - a.metric || a.code.localeCompare(b.code, 'ru'),
    );

    const warnings: string[] = [];
    const [first, second] = ranked;
    if (first) {
      if (second && first.metric - second.metric < WEIGHTED_AVERAGE_GAP_THRESHOLD) {
        warnings.push(WARNING_CLOSE_SCORES);
      }
      if (first.matchPercent < LOW_ENGAGEMENT_PERCENT) warnings.push(WARNING_LOW_ENGAGEMENT);
    }

    return {
      strategyId: ID,
      strategyTitle: TITLE,
      userVector,
      ranked,
      top: ranked.slice(0, TOP_N),
      warnings,
    };
  },
};
