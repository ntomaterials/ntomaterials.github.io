/**
 * Чтение и валидация /data/*.csv на этапе сборки.
 *
 * Модуль исполняется только в Node (Vite-плагин и unit-тесты) и никогда
 * не попадает в клиентский бандл — PapaParse тоже остаётся build-time
 * зависимостью.
 *
 * Любая проблема в данных приводит к DataValidationError со списком всех
 * найденных ошибок с указанием файла и строки (раздел 9 ТЗ). Собираем все
 * ошибки разом, а не падаем на первой — методисту так быстрее чинить.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Papa from 'papaparse';

import type {
  AnswerOption,
  Block,
  Component,
  Dataset,
  Profile,
  Question,
} from '../src/types';
import { SCALE_MAX } from '../src/scoring/constants';

export const MATRIX_FILE = 'nto_matrix_with_activities.csv';
export const QUESTIONS_FILE = 'nto_questions.csv';
export const PROFILES_FILE = 'nto_profiles.csv';

/** Ошибка валидации данных: содержит человекочитаемый список проблем. */
export class DataValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    const body = issues.map((issue) => `  • ${issue}`).join('\n');
    super(
      `Данные теста не прошли валидацию (${issues.length} шт.). Сборка остановлена.\n\n` +
        `${body}\n\n` +
        `Исправьте указанные строки в CSV-файлах каталога /data и запустите сборку заново.\n` +
        `Формат файлов описан в README.md, раздел «Формат данных».`,
    );
    this.name = 'DataValidationError';
    this.issues = issues;
  }
}

/** Накопитель ошибок: собирает все проблемы и бросает одну сводную ошибку. */
class IssueList {
  private readonly issues: string[] = [];

  add(file: string, line: number | null, message: string): void {
    const where = line === null ? `data/${file}` : `data/${file}:${line}`;
    this.issues.push(`${where} — ${message}`);
  }

  get isEmpty(): boolean {
    return this.issues.length === 0;
  }

  throwIfAny(): void {
    if (this.issues.length > 0) throw new DataValidationError(this.issues);
  }
}

/**
 * Обозначения блоков. Матрица и банк вопросов заполняются людьми в Excel,
 * поэтому принимаем и латиницу, и кириллицу — визуально это одни и те же буквы.
 */
const BLOCK_ALIASES: Readonly<Record<string, Block>> = {
  A: 'A', // латинская A
  А: 'A', // кириллическая А
  B: 'B', // латинская B
  Б: 'B', // кириллическая Б
};

/** Префикс идентификатора вопроса — кириллический, как в ТЗ («А-01», «Б-03»). */
const BLOCK_ID_PREFIX: Readonly<Record<Block, string>> = { A: 'А', B: 'Б' };

const BLOCK_TITLE: Readonly<Record<Block, string>> = {
  A: 'А (предметные кластеры)',
  B: 'Б (типы деятельности)',
};

/** Колонки банка вопросов и соответствующие им баллы. */
const OPTION_COLUMNS: readonly { column: string; value: AnswerOption['value'] }[] = [
  { column: 'positive_3', value: 3 },
  { column: 'positive_2', value: 2 },
  { column: 'neutral_1', value: 1 },
  { column: 'negative_0', value: 0 },
];

const REQUIRED_QUESTION_COLUMNS = [
  'block',
  'group',
  'question_text',
  ...OPTION_COLUMNS.map((option) => option.column),
] as const;

interface RawTable {
  readonly header: readonly string[];
  /** Строки данных вместе с исходным номером строки в файле (1-based). */
  readonly rows: readonly { readonly line: number; readonly cells: readonly string[] }[];
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Парсит CSV в таблицу со «сквозной» нумерацией строк файла.
 *
 * Пустые строки пропускаются, но номера строк остаются настоящими —
 * иначе сообщение об ошибке отправит методиста не туда.
 */
function parseTable(file: string, dataDir: string, issues: IssueList): RawTable | null {
  let text: string;
  try {
    text = stripBom(readFileSync(join(dataDir, file), 'utf8'));
  } catch {
    issues.add(file, null, 'файл не найден или не читается');
    return null;
  }

  // Формат зафиксирован как CSV с запятой (раздел 3 ТЗ) — задаём delimiter явно,
  // а не полагаемся на автоопределение PapaParse: на маленьких файлах (мало строк
  // или мало данных для набора статистики) оно иногда не набирает уверенности и
  // возвращает предупреждение UndetectableDelimiter, даже когда сам разбор верный.
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: false, delimiter: ',' });
  for (const error of parsed.errors) {
    const line = typeof error.row === 'number' ? error.row + 1 : null;
    issues.add(file, line, `не удалось разобрать CSV: ${error.message}`);
  }

  const dropTrailingEmpty = (cells: string[]): string[] => {
    let end = cells.length;
    while (end > 0 && cells[end - 1] === '') end -= 1;
    return cells.slice(0, end);
  };

  const meaningful = parsed.data
    .map((cells, index) => ({
      line: index + 1,
      cells: (cells ?? []).map((cell) => (cell ?? '').trim()),
    }))
    .filter((row) => row.cells.some((cell) => cell !== ''));

  const headerRow = meaningful[0];
  if (!headerRow) {
    issues.add(file, null, 'файл пуст: нет ни строки заголовка, ни данных');
    return null;
  }

  // Excel любит дописывать «хвост» из пустых колонок — отбрасываем его,
  // но только за пределами ширины заголовка, чтобы не проглотить дыру в данных.
  const header = dropTrailingEmpty(headerRow.cells);
  const rows = meaningful.slice(1).map((row) => ({
    line: row.line,
    cells: row.cells.length > header.length ? dropTrailingEmpty(row.cells) : row.cells,
  }));

  return { header, rows };
}

function normalizeBlock(raw: string): Block | null {
  return BLOCK_ALIASES[raw.toUpperCase()] ?? null;
}

interface MatrixData {
  readonly profileCodes: readonly string[];
  readonly components: readonly Component[];
}

/**
 * Матрица весов: block, group, затем по столбцу на каждый профиль.
 * Число компонент и профилей определяется размером файла, а не константой.
 */
function parseMatrix(dataDir: string, issues: IssueList): MatrixData | null {
  const table = parseTable(MATRIX_FILE, dataDir, issues);
  if (!table) return null;

  if (table.header.length < 3) {
    issues.add(
      MATRIX_FILE,
      1,
      `в заголовке ${table.header.length} колонок, а нужно минимум 3: ` +
        '«block», «group» и хотя бы один код профиля',
    );
    return null;
  }

  const profileCodes = table.header.slice(2);
  profileCodes.forEach((code, index) => {
    if (code === '') {
      issues.add(
        MATRIX_FILE,
        1,
        `пустой код профиля в колонке №${index + 3} — у каждого столбца весов должен быть код`,
      );
    }
  });

  const seenCodes = new Map<string, number>();
  profileCodes.forEach((code, index) => {
    if (code === '') return;
    const first = seenCodes.get(code);
    if (first !== undefined) {
      issues.add(
        MATRIX_FILE,
        1,
        `код профиля «${code}» повторяется в колонках №${first + 3} и №${index + 3}`,
      );
    } else {
      seenCodes.set(code, index);
    }
  });

  const components: Component[] = [];
  const seenGroups = new Map<string, number>();

  for (const row of table.rows) {
    const rawBlock = row.cells[0] ?? '';
    const name = row.cells[1] ?? '';
    const block = normalizeBlock(rawBlock);

    if (block === null) {
      issues.add(
        MATRIX_FILE,
        row.line,
        `неизвестное значение блока «${rawBlock}» в колонке «block»; допустимы «А»/«A» (кластер) и «Б»/«B» (тип деятельности)`,
      );
      continue;
    }
    if (name === '') {
      issues.add(MATRIX_FILE, row.line, 'пустое название в колонке «group»');
      continue;
    }

    const duplicateOf = seenGroups.get(name);
    if (duplicateOf !== undefined) {
      issues.add(
        MATRIX_FILE,
        row.line,
        `название «${name}» уже встречалось в строке ${duplicateOf}; названия строк матрицы должны быть уникальными`,
      );
      continue;
    }
    seenGroups.set(name, row.line);

    const cells = row.cells.slice(2, 2 + profileCodes.length);
    if (row.cells.length - 2 !== profileCodes.length) {
      issues.add(
        MATRIX_FILE,
        row.line,
        `в строке «${name}» ${Math.max(row.cells.length - 2, 0)} весов, а профилей ${profileCodes.length} — количество должно совпадать`,
      );
      continue;
    }

    // Некорректный вес заменяем нулём и идём дальше: строка остаётся в наборе,
    // и проверки банка вопросов не сыплют каскадом мнимых ошибок «группа не найдена».
    // Сборка всё равно упадёт — ошибка уже записана.
    const weights = cells.map((cell, index) => {
      const code = profileCodes[index] || `колонка №${index + 3}`;
      if (cell === '') {
        issues.add(MATRIX_FILE, row.line, `пустой вес в строке «${name}», профиль «${code}»`);
        return 0;
      }
      const value = Number(cell);
      if (!Number.isInteger(value) || value < 0 || value > SCALE_MAX) {
        issues.add(
          MATRIX_FILE,
          row.line,
          `вес «${cell}» в строке «${name}», профиль «${code}» — допустимы только целые числа от 0 до ${SCALE_MAX}`,
        );
        return 0;
      }
      return value;
    });

    components.push({ index: components.length, block, name, weights });
  }

  for (const block of ['A', 'B'] as const) {
    if (!components.some((component) => component.block === block)) {
      issues.add(
        MATRIX_FILE,
        null,
        `в матрице нет ни одной строки блока ${BLOCK_TITLE[block]}`,
      );
    }
  }

  profileCodes.forEach((code, profileIndex) => {
    if (code === '') return;
    const sum = components.reduce((acc, component) => acc + (component.weights[profileIndex] ?? 0), 0);
    if (sum === 0 && components.length > 0) {
      issues.add(
        MATRIX_FILE,
        null,
        `у профиля «${code}» все веса равны нулю — такой профиль невозможно рекомендовать, проверьте столбец`,
      );
    }
  });

  return { profileCodes, components };
}

interface ProfileRef {
  readonly code: string;
  readonly fullName: string;
  readonly line: number;
}

/** Справочник профилей: code, full_name. */
function parseProfiles(dataDir: string, issues: IssueList): readonly ProfileRef[] | null {
  const table = parseTable(PROFILES_FILE, dataDir, issues);
  if (!table) return null;

  const codeIndex = table.header.indexOf('code');
  const nameIndex = table.header.indexOf('full_name');
  if (codeIndex === -1 || nameIndex === -1) {
    issues.add(
      PROFILES_FILE,
      1,
      `в заголовке нет обязательных колонок «code» и «full_name»; найдено: ${table.header.join(', ')}`,
    );
    return null;
  }

  const profiles: ProfileRef[] = [];
  const seen = new Map<string, number>();

  for (const row of table.rows) {
    const code = row.cells[codeIndex] ?? '';
    const fullName = row.cells[nameIndex] ?? '';

    if (code === '') {
      issues.add(PROFILES_FILE, row.line, 'пустой код профиля в колонке «code»');
      continue;
    }
    if (fullName === '') {
      issues.add(
        PROFILES_FILE,
        row.line,
        `у профиля «${code}» пустое название в колонке «full_name»`,
      );
      continue;
    }
    const duplicateOf = seen.get(code);
    if (duplicateOf !== undefined) {
      issues.add(
        PROFILES_FILE,
        row.line,
        `код профиля «${code}» уже был в строке ${duplicateOf} — коды должны быть уникальными`,
      );
      continue;
    }
    seen.set(code, row.line);
    profiles.push({ code, fullName, line: row.line });
  }

  return profiles;
}

/** Сверяет коды столбцов матрицы со справочником профилей — в обе стороны. */
function crossCheckProfiles(
  matrixCodes: readonly string[],
  profiles: readonly ProfileRef[],
  issues: IssueList,
): void {
  const inMatrix = new Set(matrixCodes.filter((code) => code !== ''));
  const inReference = new Set(profiles.map((profile) => profile.code));

  for (const code of inMatrix) {
    if (!inReference.has(code)) {
      issues.add(
        PROFILES_FILE,
        null,
        `в матрице есть столбец профиля «${code}», но в справочнике такого кода нет — добавьте строку «${code},<полное название>»`,
      );
    }
  }
  for (const profile of profiles) {
    if (!inMatrix.has(profile.code)) {
      issues.add(
        PROFILES_FILE,
        profile.line,
        `профиль «${profile.code}» есть в справочнике, но в матрице ${MATRIX_FILE} нет столбца с таким кодом`,
      );
    }
  }
  if (inMatrix.size !== inReference.size) {
    issues.add(
      PROFILES_FILE,
      null,
      `число профилей не совпадает: в матрице ${inMatrix.size}, в справочнике ${inReference.size}`,
    );
  }
}

/** Банк вопросов. Число вопросов и их распределение по блокам берётся из файла. */
function parseQuestions(
  dataDir: string,
  components: readonly Component[],
  issues: IssueList,
): readonly Question[] | null {
  const table = parseTable(QUESTIONS_FILE, dataDir, issues);
  if (!table) return null;

  const columnIndex = new Map<string, number>();
  const missing: string[] = [];
  for (const column of REQUIRED_QUESTION_COLUMNS) {
    const index = table.header.indexOf(column);
    if (index === -1) missing.push(column);
    else columnIndex.set(column, index);
  }
  if (missing.length > 0) {
    issues.add(
      QUESTIONS_FILE,
      1,
      `в заголовке нет обязательных колонок: ${missing.join(', ')}; найдено: ${table.header.join(', ')}`,
    );
    return null;
  }

  /** Поиск компоненты по названию — сравнение точное, как требует раздел 9 ТЗ. */
  const componentByName = new Map<string, Component>();
  for (const component of components) componentByName.set(component.name, component);

  const cell = (row: RawTable['rows'][number], column: string): string =>
    row.cells[columnIndex.get(column) as number] ?? '';

  const questions: Question[] = [];
  const counters: Record<Block, number> = { A: 0, B: 0 };

  for (const row of table.rows) {
    const rawBlock = cell(row, 'block');
    const group = cell(row, 'group');
    const text = cell(row, 'question_text');

    const block = normalizeBlock(rawBlock);
    if (block === null) {
      issues.add(
        QUESTIONS_FILE,
        row.line,
        `неизвестное значение блока «${rawBlock}»; допустимы «А»/«A» и «Б»/«B»`,
      );
      continue;
    }
    if (text === '') {
      issues.add(QUESTIONS_FILE, row.line, 'пустая формулировка вопроса в колонке «question_text»');
      continue;
    }

    const component = componentByName.get(group);
    if (!component) {
      const candidates = components
        .filter((item) => item.block === block)
        .map((item) => `«${item.name}»`)
        .join(', ');
      issues.add(
        QUESTIONS_FILE,
        row.line,
        `значение group «${group}» не найдено среди строк матрицы ${MATRIX_FILE}. ` +
          `Допустимые названия блока ${BLOCK_TITLE[block]}: ${candidates || '(нет строк)'}`,
      );
      continue;
    }
    if (component.block !== block) {
      issues.add(
        QUESTIONS_FILE,
        row.line,
        `«${group}» в матрице относится к блоку ${BLOCK_TITLE[component.block]}, ` +
          `а вопрос помечен блоком ${BLOCK_TITLE[block]} — исправьте колонку «block»`,
      );
      continue;
    }

    const options: AnswerOption[] = [];
    let optionsValid = true;
    for (const { column, value } of OPTION_COLUMNS) {
      const label = cell(row, column);
      if (label === '') {
        issues.add(
          QUESTIONS_FILE,
          row.line,
          `пустая формулировка варианта ответа в колонке «${column}» (балл ${value})`,
        );
        optionsValid = false;
        continue;
      }
      options.push({ value, label });
    }
    if (!optionsValid) continue;

    counters[block] += 1;
    questions.push({
      id: `${BLOCK_ID_PREFIX[block]}-${String(counters[block]).padStart(2, '0')}`,
      block,
      group,
      componentIndex: component.index,
      text,
      options,
    });
  }

  // Без вопросов компонента вектора пользователя не определена — это ошибка данных.
  for (const component of components) {
    const count = questions.filter((question) => question.componentIndex === component.index).length;
    if (count === 0) {
      issues.add(
        QUESTIONS_FILE,
        null,
        `нет ни одного вопроса для «${component.name}» (блок ${BLOCK_TITLE[component.block]}) — ` +
          `добавьте строку со значением group «${component.name}»`,
      );
    }
  }

  if (questions.length === 0 && issues.isEmpty) {
    issues.add(QUESTIONS_FILE, null, 'в банке нет ни одного вопроса');
  }

  return questions;
}

/**
 * Читает три CSV из каталога `dataDir`, проверяет их и собирает Dataset.
 * Бросает DataValidationError со списком всех найденных проблем.
 */
export function loadDataset(dataDir: string): Dataset {
  const issues = new IssueList();

  const matrix = parseMatrix(dataDir, issues);
  const profileRefs = parseProfiles(dataDir, issues);

  // Дальше идти можно только если обе таблицы разобраны: остальные проверки
  // опираются на их содержимое и без него насыпали бы ложных ошибок.
  if (!matrix || !profileRefs) {
    issues.throwIfAny();
    throw new DataValidationError(['не удалось прочитать входные данные']);
  }

  crossCheckProfiles(matrix.profileCodes, profileRefs, issues);
  const questions = parseQuestions(dataDir, matrix.components, issues);

  issues.throwIfAny();
  if (!questions) throw new DataValidationError(['не удалось прочитать банк вопросов']);

  // Порядок профилей в Dataset — порядок столбцов матрицы: так индекс профиля
  // напрямую индексирует Component.weights.
  const nameByCode = new Map(profileRefs.map((profile) => [profile.code, profile.fullName]));
  const profiles: Profile[] = matrix.profileCodes.map((code, profileIndex) => ({
    code,
    fullName: nameByCode.get(code) as string,
    vector: matrix.components.map((component) => component.weights[profileIndex] as number),
  }));

  const clusterCount = matrix.components.filter((component) => component.block === 'A').length;
  const activityCount = matrix.components.filter((component) => component.block === 'B').length;
  const blockAQuestionCount = questions.filter((question) => question.block === 'A').length;
  const blockBQuestionCount = questions.length - blockAQuestionCount;

  return {
    components: matrix.components,
    profiles,
    questions,
    meta: {
      clusterCount,
      activityCount,
      componentCount: matrix.components.length,
      profileCount: profiles.length,
      questionCount: questions.length,
      blockAQuestionCount,
      blockBQuestionCount,
    },
  };
}
