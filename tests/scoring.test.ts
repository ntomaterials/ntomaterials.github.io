/**
 * Проверка расчёта на примерах, посчитанных вручную по алгоритму раздела 4 ТЗ.
 *
 * Все ожидаемые числа получены ручным пересчётом на маленьком наборе данных
 * (tests/fixtures/tiny), а не снятием текущего вывода кода — иначе тест
 * зафиксировал бы ошибку вместо методики.
 *
 * Набор данных:
 *   компоненты: C1, C2 (блок А), T1 (блок Б)
 *   матрица:  C1 → P1=3, P2=0
 *             C2 → P1=1, P2=2
 *             T1 → P1=2, P2=3
 *   вопросы:  А-01, А-02 → C1;  А-03, А-04 → C2;  Б-01 → T1
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { loadDataset } from '../build/data-loader';
import { evaluateAnswers } from '../src/scoring';
import {
  componentWeights,
  distanceToMatchPercent,
  weightedEuclideanDistance,
} from '../src/scoring/euclidean';
import { WARNING_CLOSE_SCORES, WARNING_LOW_ENGAGEMENT } from '../src/scoring/messages';
import { buildUserVector } from '../src/scoring/user-vector';
import { profileScore } from '../src/scoring/weighted-average';
import type { Answer } from '../src/types';

const here = dirname(fileURLToPath(import.meta.url));
const tiny = loadDataset(resolve(here, 'fixtures/tiny'));

/**
 * Ответы из примера на 4-балльной шкале {3, 2, 1, 0}:
 * C1 → 3 и 2, C2 → 1 и 0, T1 → 2.
 */
const SAMPLE_ANSWERS: Record<string, Answer> = {
  'А-01': 3,
  'А-02': 2,
  'А-03': 1,
  'А-04': 0,
  'Б-01': 2,
};

function uniformAnswers(value: Answer): Record<string, Answer> {
  return Object.fromEntries(tiny.questions.map((question) => [question.id, value]));
}

describe('вектор пользователя (шаг 3)', () => {
  it('усредняет ответы участника внутри кластера без дополнительной нормализации', () => {
    // Ответы уже даны в шкале матрицы [0 .. 3], поэтому вектор пользователя —
    // это просто среднее ответов по вопросам компоненты.
    // U_C1 = (3 + 2) / 2 = 2.5
    // U_C2 = (1 + 0) / 2 = 0.5
    // U_T1 = 2
    expect(buildUserVector(SAMPLE_ANSWERS, tiny)).toEqual([2.5, 0.5, 2]);
  });

  it('размерность вектора равна числу строк матрицы, а не константе', () => {
    expect(buildUserVector(SAMPLE_ANSWERS, tiny)).toHaveLength(tiny.components.length);
    expect(tiny.components).toHaveLength(3);
  });
});

describe('веса компонент (шаг 5)', () => {
  it('делит вес компоненты на сумму весов профиля', () => {
    // P1 = [3, 1, 2], Σ = 6
    expect(componentWeights([3, 1, 2])).toEqual([0.5, 1 / 6, 1 / 3]);
  });

  it('возвращает null, если у профиля нет ненулевых весов', () => {
    expect(componentWeights([0, 0, 0])).toBeNull();
  });
});

describe('взвешенное евклидово расстояние (шаг 6)', () => {
  const U = [2.5, 0.5, 2];

  it('считает расстояние до профиля P1', () => {
    // w = [0.5, 1/6, 1/3]
    // 0.5 × (2.5 − 3)² = 0.5 × 0.25 = 0.125
    // 1/6 × (0.5 − 1)² = 1/6 × 0.25 = 0.0416666…
    // 1/3 × (2 − 2)²   = 0
    // Σ = 0.1666666… → D = √(1/6) = 0.4082483…
    expect(weightedEuclideanDistance(U, [3, 1, 2])).toBeCloseTo(0.40824829, 7);
  });

  it('считает расстояние до профиля P2, игнорируя компоненту с нулевым весом', () => {
    // w = [0, 0.4, 0.6]
    // 0.4 × (0.5 − 2)² = 0.4 × 2.25 = 0.9
    // 0.6 × (2 − 3)²   = 0.6 × 1    = 0.6
    // Σ = 1.5 → D = √1.5 = 1.2247449…
    expect(weightedEuclideanDistance(U, [0, 2, 3])).toBeCloseTo(1.22474487, 7);
  });

  it('исключает профиль без единого ненулевого веса', () => {
    expect(weightedEuclideanDistance(U, [0, 0, 0])).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('процент совпадения (шаг 7)', () => {
  it('переводит расстояние в проценты по опорным точкам из ТЗ', () => {
    expect(distanceToMatchPercent(0)).toBe(100);
    expect(distanceToMatchPercent(1.5)).toBe(50);
    expect(distanceToMatchPercent(3)).toBe(0);
  });

  it('даёт 0% для исключённого профиля', () => {
    expect(distanceToMatchPercent(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('итоговый результат — евклидова методика', () => {
  const result = evaluateAnswers(SAMPLE_ANSWERS, tiny, 'euclidean');

  it('ранжирует профили по возрастанию расстояния', () => {
    expect(result.ranked.map((item) => item.code)).toEqual(['P1', 'P2']);
  });

  it('показывает проценты, посчитанные вручную', () => {
    // round((1 − 0.40824829 / 3) × 100) = round(86.392) = 86
    // round((1 − 1.22474487 / 3) × 100) = round(59.175) = 59
    expect(result.ranked.map((item) => item.matchPercent)).toEqual([86, 59]);
  });

  it('подставляет полные названия профилей из справочника', () => {
    expect(result.top[0].fullName).toBe('Профиль один');
  });

  it('в «почему подходит» попадают темы с наименьшим вкладом в расстояние', () => {
    // Вклады для P1: C1 = 0.125, C2 = 0.0416667, T1 = 0 (точное совпадение)
    expect(result.top[0].strengths.map((item) => item.name)).toEqual(['T1', 'C2']);
  });

  it('определяет доминирующий тип деятельности профиля', () => {
    expect(result.top[0].dominantActivity).toBe('T1');
  });

  it('не предупреждает, когда разрыв большой, а совпадение высокое', () => {
    // gap = 1.22474487 − 0.40824829 = 0.81650 ≥ 0.30; 86% ≥ 45%
    expect(result.warnings).toEqual([]);
    expect(result.top[0].cautions).toEqual([]);
  });

  it('предупреждает по теме, которую профиль требует, а участник не любит', () => {
    // P2: вес C2 = 2 (≥ 2), балл участника по C2 = 0.5 / 3 ≈ 0.167 (< 0.35)
    const p2 = result.ranked.find((item) => item.code === 'P2');
    expect(p2?.cautions.map((item) => item.name)).toEqual(['C2']);
  });
});

describe('проверки надёжности (шаг 8)', () => {
  it('сообщает о низкой вовлечённости и близких результатах при самых низких ответах', () => {
    // U = [0, 0, 0] — участник везде выбрал вариант с минимальным баллом
    // D(P1) = √(0.5×9 + 1/6×1 + 1/3×4) = √6      = 2.4494897… → 18%
    // D(P2) = √(0.4×4 + 0.6×9)          = √7      = 2.6457513… → 12%
    // gap = 0.19626 < 0.30 → предупреждение о близких результатах
    // 18% < 45%           → предупреждение о низкой вовлечённости
    const result = evaluateAnswers(uniformAnswers(0), tiny, 'euclidean');

    expect(result.ranked.map((item) => item.matchPercent)).toEqual([18, 12]);
    expect(result.warnings).toEqual([WARNING_CLOSE_SCORES, WARNING_LOW_ENGAGEMENT]);
  });

  it('не выдаёт предупреждений, когда разрыв достаточный', () => {
    // U = [3, 3, 3] — участник везде выбрал вариант с максимальным баллом
    // D(P1) = √(0 + 1/6×4 + 1/3×1) = √1   = 1.0        → 67%
    // D(P2) = √(0.4×1 + 0.6×0)     = √0.4 = 0.6324555… → 79%
    // gap = 0.36754 ≥ 0.30
    const result = evaluateAnswers(uniformAnswers(3), tiny, 'euclidean');

    expect(result.ranked.map((item) => item.code)).toEqual(['P2', 'P1']);
    expect(result.ranked.map((item) => item.matchPercent)).toEqual([79, 67]);
    expect(result.warnings).toEqual([]);
  });
});

describe('альтернативная методика — средневзвешенный балл', () => {
  it('считает SCORE = (4 × S_A + 2 × S_B) / 6', () => {
    const U = [2.5, 0.5, 2];
    // score_A: C1 = 2.5/3 = 0.8333333, C2 = 0.5/3 = 0.1666667; score_B: T1 = 2/3 = 0.6666667
    // P1: S_A = (3×0.8333333 + 1×0.1666667) / 4 = 2.6666667 / 4 = 0.6666667
    //     S_B = (2×0.6666667) / 2 = 0.6666667
    //     SCORE = (4×0.6666667 + 2×0.6666667) / 6 = 4.0 / 6 = 0.6666667
    // P2: S_A = (0×0.8333333 + 2×0.1666667) / 2 = 0.1666667
    //     S_B = (3×0.6666667) / 3 = 0.6666667
    //     SCORE = (4×0.1666667 + 2×0.6666667) / 6 = 2.0 / 6 = 0.3333333
    expect(profileScore(tiny.profiles[0], tiny, U)).toBeCloseTo(0.66666667, 8);
    expect(profileScore(tiny.profiles[1], tiny, U)).toBeCloseTo(0.33333333, 8);
  });

  it('ранжирует по убыванию балла и показывает его как процент', () => {
    const result = evaluateAnswers(SAMPLE_ANSWERS, tiny, 'weighted-average');

    expect(result.ranked.map((item) => item.code)).toEqual(['P1', 'P2']);
    expect(result.ranked.map((item) => item.matchPercent)).toEqual([67, 33]);
  });
});

describe('устойчивость к замене данных', () => {
  it('размерности берутся из CSV, а не из констант', () => {
    expect(tiny.meta).toMatchObject({
      clusterCount: 2,
      activityCount: 1,
      profileCount: 2,
      questionCount: 5,
      blockAQuestionCount: 4,
      blockBQuestionCount: 1,
    });
  });

  it('идентификаторы вопросов нумеруются внутри блока по данным файла', () => {
    expect(tiny.questions.map((question) => question.id)).toEqual([
      'А-01',
      'А-02',
      'А-03',
      'А-04',
      'Б-01',
    ]);
  });

  it('вопросы привязаны к тем же строкам, что и в матрице', () => {
    const groupsByComponent = tiny.questions.map(
      (question) => tiny.components[question.componentIndex].name,
    );
    expect(groupsByComponent).toEqual(['C1', 'C1', 'C2', 'C2', 'T1']);
  });
});
