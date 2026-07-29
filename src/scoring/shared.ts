/** Вспомогательные функции, общие для стратегий расчёта. */

import type { Component, Dataset, Profile } from '../types';
import { CAUTION_SCORE_THRESHOLD, CAUTION_WEIGHT_THRESHOLD } from './constants';
import type { ComponentHighlight } from './types';
import { toNormalizedScore } from './user-vector';

export function sum(values: readonly number[]): number {
  let total = 0;
  for (const value of values) total += value;
  return total;
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/** Собирает описание компоненты для карточки результата. */
export function highlight(
  component: Component,
  profile: Profile,
  userVector: readonly number[],
): ComponentHighlight {
  return {
    componentIndex: component.index,
    name: component.name,
    block: component.block,
    profileWeight: profile.vector[component.index],
    userScore: toNormalizedScore(userVector[component.index]),
  };
}

/**
 * Тип деятельности, доминирующий для профиля: строка блока Б с максимальным
 * весом. Если у профиля нет ненулевых весов в блоке Б — возвращает null.
 */
export function dominantActivity(profile: Profile, dataset: Dataset): string | null {
  let best: Component | null = null;
  for (const component of dataset.components) {
    if (component.block !== 'B') continue;
    const weight = profile.vector[component.index];
    if (weight <= 0) continue;
    if (best === null || weight > profile.vector[best.index]) best = component;
  }
  return best ? best.name : null;
}

/**
 * Темы, по которым стоит предупредить участника: профиль на них опирается
 * (вес ≥ 2), а участник ответил про них скорее отрицательно (балл < 0.35).
 */
export function findCautions(
  profile: Profile,
  dataset: Dataset,
  userVector: readonly number[],
  blocks: readonly Component['block'][] = ['A', 'B'],
): ComponentHighlight[] {
  return dataset.components
    .filter((component) => blocks.includes(component.block))
    .filter((component) => profile.vector[component.index] >= CAUTION_WEIGHT_THRESHOLD)
    .filter((component) => toNormalizedScore(userVector[component.index]) < CAUTION_SCORE_THRESHOLD)
    .map((component) => highlight(component, profile, userVector))
    // Сначала самые «ядровые» для профиля темы.
    .sort((a, b) => b.profileWeight - a.profileWeight || a.userScore - b.userScore);
}
