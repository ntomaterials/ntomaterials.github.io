/**
 * Общие типы данных теста.
 *
 * Все структуры собираются на этапе сборки из /data/*.csv (см. build/data-loader.ts)
 * и попадают в бандл как готовый JSON. В рантайме CSV не читается.
 *
 * Ничего из размерностей (число кластеров, типов деятельности, профилей, вопросов)
 * в коде не зашито — всё берётся из этих структур.
 */

/** Балл ответа по единой 4-балльной шкале (раздел 3.4 ТЗ). */
export type Answer = 0 | 1 | 2 | 3;

/** Блок вопроса: A — предметный кластер, B — тип деятельности. */
export type Block = 'A' | 'B';

/** Вариант ответа с формулировкой из банка вопросов. */
export interface AnswerOption {
  /** Балл: 3, 2, 1, 0. */
  readonly value: Answer;
  /** Формулировка варианта для конкретного вопроса. */
  readonly label: string;
}

/**
 * Компонента вектора: строка матрицы весов.
 * Блок A — предметный кластер, блок B — тип деятельности.
 */
export interface Component {
  /** Индекс компоненты в векторах U и P[p]. */
  readonly index: number;
  readonly block: Block;
  /** Название кластера / типа деятельности — как в матрице. */
  readonly name: string;
  /** Веса по профилям, в порядке массива Dataset.profiles. Значения 0..3. */
  readonly weights: readonly number[];
}

/** Профиль олимпиады. */
export interface Profile {
  /** Код профиля, как в заголовке столбца матрицы: АБП, АТС, … */
  readonly code: string;
  /** Полное название для интерфейса — из nto_profiles.csv. */
  readonly fullName: string;
  /** Вектор профиля P[p]: значения матрицы по всем компонентам. */
  readonly vector: readonly number[];
}

/** Вопрос теста. */
export interface Question {
  /** Человекочитаемый идентификатор: «А-01», «Б-03». */
  readonly id: string;
  readonly block: Block;
  /** Название кластера / типа деятельности из колонки group. */
  readonly group: string;
  /** Индекс компоненты, к которой относится вопрос. */
  readonly componentIndex: number;
  readonly text: string;
  /** Варианты ответа, отсортированы от 3 к 0. */
  readonly options: readonly AnswerOption[];
}

/** Сводка по размерностям — считается из данных, используется в интерфейсе. */
export interface DatasetMeta {
  readonly clusterCount: number;
  readonly activityCount: number;
  readonly componentCount: number;
  readonly profileCount: number;
  readonly questionCount: number;
  readonly blockAQuestionCount: number;
  readonly blockBQuestionCount: number;
}

/** Полный набор данных теста, встроенный в бандл на этапе сборки. */
export interface Dataset {
  readonly components: readonly Component[];
  readonly profiles: readonly Profile[];
  readonly questions: readonly Question[];
  readonly meta: DatasetMeta;
}
