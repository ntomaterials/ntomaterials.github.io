/**
 * Проверка чтения и валидации CSV (раздел 9 ТЗ).
 *
 * Отдельно проверяем реальные данные из /data — если методист заменил CSV
 * с ошибкой, этот тест упадёт раньше сборки и покажет тот же текст ошибки.
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DataValidationError, loadDataset } from '../build/data-loader';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, '..');

describe('реальные данные из /data', () => {
  const dataset = loadDataset(resolve(projectRoot, 'data'));

  it('читаются без ошибок валидации', () => {
    expect(dataset.profiles.length).toBeGreaterThan(0);
    expect(dataset.questions.length).toBeGreaterThan(0);
  });

  it('число профилей в матрице и справочнике совпадает', () => {
    expect(dataset.profiles).toHaveLength(dataset.meta.profileCount);
    for (const profile of dataset.profiles) {
      expect(profile.fullName).not.toBe('');
      expect(profile.vector).toHaveLength(dataset.components.length);
    }
  });

  it('каждая строка матрицы обеспечена хотя бы одним вопросом', () => {
    for (const component of dataset.components) {
      const count = dataset.questions.filter(
        (question) => question.componentIndex === component.index,
      ).length;
      expect(count, `нет вопросов для «${component.name}»`).toBeGreaterThan(0);
    }
  });

  it('все веса — целые числа от 0 до 3', () => {
    for (const component of dataset.components) {
      for (const weight of component.weights) {
        expect(Number.isInteger(weight)).toBe(true);
        expect(weight).toBeGreaterThanOrEqual(0);
        expect(weight).toBeLessThanOrEqual(3);
      }
    }
  });

  it('у каждого вопроса ровно четыре варианта ответа со шкалой 3…0', () => {
    for (const question of dataset.questions) {
      expect(question.options.map((option) => option.value)).toEqual([3, 2, 1, 0]);
      for (const option of question.options) expect(option.label).not.toBe('');
    }
  });

  it('блоки разделены по признаку из матрицы', () => {
    expect(dataset.meta.clusterCount).toBeGreaterThan(0);
    expect(dataset.meta.activityCount).toBeGreaterThan(0);
    expect(dataset.meta.clusterCount + dataset.meta.activityCount).toBe(
      dataset.components.length,
    );
  });
});

describe('битые данные останавливают сборку', () => {
  function loadBroken(): void {
    loadDataset(resolve(here, 'fixtures/broken'));
  }

  it('бросает DataValidationError, а не падает молча', () => {
    expect(loadBroken).toThrow(DataValidationError);
  });

  function issues(): readonly string[] {
    try {
      loadBroken();
    } catch (error) {
      if (error instanceof DataValidationError) return error.issues;
      throw error;
    }
    throw new Error('ожидалась ошибка валидации, но данные прошли проверку');
  }

  it('сообщает про вес вне диапазона 0–3 с указанием файла, строки и профиля', () => {
    expect(issues()).toContainEqual(
      expect.stringContaining('data/nto_matrix_with_activities.csv:3'),
    );
    expect(issues().join('\n')).toContain('вес «5»');
    expect(issues().join('\n')).toContain('профиль «P3»');
  });

  it('сообщает про профиль из матрицы, которого нет в справочнике', () => {
    expect(issues().join('\n')).toContain('«P3»');
  });

  it('сообщает про профиль из справочника, которого нет в матрице', () => {
    const text = issues().join('\n');
    expect(text).toContain('data/nto_profiles.csv:4');
    expect(text).toContain('«P9»');
  });

  it('сообщает про group вопроса, которого нет в матрице', () => {
    const text = issues().join('\n');
    expect(text).toContain('data/nto_questions.csv:3');
    expect(text).toContain('«Опечатка в названии»');
  });

  it('сообщает про пустую формулировку варианта ответа', () => {
    const text = issues().join('\n');
    expect(text).toContain('data/nto_questions.csv:4');
    expect(text).toContain('negative_0');
  });

  it('сообщает про строки матрицы, для которых не нашлось вопросов', () => {
    const text = issues().join('\n');
    expect(text).toContain('нет ни одного вопроса для «C2»');
  });
});
