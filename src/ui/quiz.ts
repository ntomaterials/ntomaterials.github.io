/** Экран вопросов: один вопрос на экран. */

import type { Answer, Dataset, Question } from '../types';
import { h } from './dom';

export interface QuizProps {
  readonly dataset: Dataset;
  /** Индекс текущего вопроса в dataset.questions. */
  readonly index: number;
  /** Ответы, данные к этому моменту: id вопроса → балл. */
  readonly answers: ReadonlyMap<string, Answer>;
  readonly onAnswer: (question: Question, value: Answer, fromPointer: boolean) => void;
  readonly onPrev: () => void;
  readonly onNext: () => void;
}

/**
 * Экран вопроса умеет обновлять состояние кнопки «Далее» без перерисовки:
 * перерисовка на каждый ответ сбрасывала бы фокус с выбранного варианта.
 */
export interface QuizView {
  readonly element: HTMLElement;
  /** Выбирает вариант по его порядковому номеру (для горячих клавиш 1–4). */
  selectOption(optionIndex: number): void;
  setAnswered(answered: boolean): void;
}

/** Порог, ниже которого изменение ответа считается сделанным мышью/пальцем. */
const POINTER_WINDOW_MS = 500;

export function renderQuiz(props: QuizProps): QuizView {
  const { dataset, index, answers } = props;
  const question = dataset.questions[index];
  const total = dataset.questions.length;
  const current = answers.get(question.id);
  const isLast = index === total - 1;
  const percent = Math.round(((index + 1) / total) * 100);

  // Отличаем выбор мышью от перебора стрелками: у нативных radio стрелки
  // и выбирают вариант, и перемещают фокус, поэтому автопереход по стрелке
  // ломал бы навигацию с клавиатуры.
  let lastPointerAt = Number.NEGATIVE_INFINITY;
  const notePointer = (): void => {
    lastPointerAt = performance.now();
  };

  const inputs: HTMLInputElement[] = [];

  const options = question.options.map((option, optionIndex) => {
    const input = h('input', {
      class: 'option__input',
      type: 'radio',
      name: `question-${question.id}`,
      value: String(option.value),
      checked: current === option.value,
      onchange: () => {
        const fromPointer = performance.now() - lastPointerAt < POINTER_WINDOW_MS;
        props.onAnswer(question, option.value, fromPointer);
      },
    });
    inputs[optionIndex] = input;

    return h(
      'label',
      { class: 'option', onpointerdown: notePointer },
      input,
      h('span', { class: 'option__marker', 'aria-hidden': 'true' }),
      h('span', { class: 'option__label', text: option.label }),
    );
  });

  const nextButton = h(
    'button',
    {
      class: 'button button--primary',
      type: 'button',
      disabled: current === undefined,
      'aria-describedby': 'nav-hint',
      onclick: props.onNext,
    },
    isLast ? 'Показать результат' : 'Далее →',
  );

  const hint = h('p', {
    id: 'nav-hint',
    class: 'nav__hint',
    text: 'Чтобы продолжить, выбери один из вариантов',
    hidden: current !== undefined,
  });

  const element = h(
    'section',
    { class: 'screen screen--quiz', 'aria-labelledby': 'question-text' },

    h(
      'div',
      { class: 'progress' },
      h(
        'div',
        { class: 'progress__row' },
        h('span', {
          class: 'progress__counter',
          text: `Вопрос ${index + 1} из ${total}`,
          'aria-live': 'polite',
        }),
        h('span', { class: 'progress__percent', text: `${percent}%` }),
      ),
      h(
        'div',
        {
          class: 'progress__track',
          role: 'progressbar',
          'aria-valuemin': '1',
          'aria-valuemax': String(total),
          'aria-valuenow': String(index + 1),
          'aria-label': 'Прогресс прохождения теста',
        },
        h('div', { class: 'progress__bar', style: `width: ${percent}%` }),
      ),
    ),

    h(
      'fieldset',
      { class: 'question' },
      h(
        'legend',
        { class: 'question__legend' },
        h('h2', {
          id: 'question-text',
          class: 'question__text',
          text: question.text,
          tabindex: '-1',
          'data-autofocus': 'true',
        }),
      ),
      h('p', { class: 'question__hint', text: 'Выбери вариант, который ближе всего к тебе' }),
      h('div', { class: 'options' }, ...options),
    ),

    h(
      'div',
      { class: 'nav' },
      h(
        'button',
        {
          class: 'button button--ghost',
          type: 'button',
          disabled: index === 0,
          onclick: props.onPrev,
        },
        '← Назад',
      ),
      nextButton,
    ),

    hint,
  );

  return {
    element,
    selectOption(optionIndex: number): void {
      const input = inputs[optionIndex];
      const option = question.options[optionIndex];
      if (!input || !option) return;
      input.checked = true;
      // Горячая клавиша — такой же осознанный выбор, как клик,
      // поэтому автопереход к следующему вопросу уместен.
      props.onAnswer(question, option.value, true);
    },
    setAnswered(answered: boolean): void {
      nextButton.disabled = !answered;
      hint.hidden = answered;
    },
  };
}
