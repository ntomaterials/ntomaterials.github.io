/** Типы результата расчёта. Общие для всех стратегий подсчёта. */

import type { Block, Dataset } from '../types';

/** Компонента вектора, вынесенная в интерфейс как аргумент «за» или «против». */
export interface ComponentHighlight {
  readonly componentIndex: number;
  readonly name: string;
  readonly block: Block;
  /** Вес компоненты в векторе профиля: 0..3. */
  readonly profileWeight: number;
  /** Нормализованный балл участника по компоненте: 0..1. */
  readonly userScore: number;
}

/** Результат по одному профилю. */
export interface ProfileResult {
  readonly profileIndex: number;
  readonly code: string;
  readonly fullName: string;
  /**
   * Значение метрики стратегии: расстояние D (меньше — лучше) либо балл SCORE
   * (больше — лучше). Наружу отдаётся ради тестов и отладки; интерфейс
   * показывает только matchPercent.
   */
  readonly metric: number;
  /** Процент совпадения для карточки результата: 0..100. */
  readonly matchPercent: number;
  /** «Почему подходит»: опорные компоненты профиля. */
  readonly strengths: readonly ComponentHighlight[];
  /** Доминирующий тип деятельности профиля (наибольший вес в блоке Б). */
  readonly dominantActivity: string | null;
  /** Темы, по которым участнику стоит показать предупреждение. */
  readonly cautions: readonly ComponentHighlight[];
}

/** Полный результат прохождения теста. */
export interface TestResult {
  readonly strategyId: string;
  readonly strategyTitle: string;
  /** Вектор пользователя U, диапазон компонент [0 .. 3]. */
  readonly userVector: readonly number[];
  /** Все профили, отсортированные от наиболее подходящего к наименее. */
  readonly ranked: readonly ProfileResult[];
  /** Первые TOP_N профилей из ranked. */
  readonly top: readonly ProfileResult[];
  /** Предупреждения о надёжности результата (шаг 8). */
  readonly warnings: readonly string[];
}

/**
 * Сменный модуль расчёта.
 *
 * Чтобы подключить другую методику, достаточно реализовать этот интерфейс
 * и зарегистрировать реализацию в src/scoring/index.ts. Ни интерфейс,
 * ни загрузчик данных при этом не меняются.
 */
export interface ScoringStrategy {
  readonly id: string;
  /** Короткое название для интерфейса. */
  readonly title: string;
  /** Пояснение методики: как считается и как читать процент. */
  readonly description: string;
  /**
   * @param userVector вектор U длины dataset.components.length, диапазон [0 .. 3]
   */
  evaluate(userVector: readonly number[], dataset: Dataset): TestResult;
}
