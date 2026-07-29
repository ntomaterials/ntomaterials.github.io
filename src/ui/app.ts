/**
 * Состояние теста и переключение экранов.
 *
 * Ответы живут только в памяти этой вкладки: ни localStorage, ни sessionStorage,
 * ни сетевых запросов — при перезагрузке страницы всё стирается (раздел 6 ТЗ).
 */

import { evaluateAnswers } from '../scoring';
import type { Answer, Dataset, Question } from '../types';
import { render } from './dom';
import type { QuizView } from './quiz';
import { renderQuiz } from './quiz';
import { renderResult } from './result';
import { renderWelcome } from './welcome';

type Screen = 'welcome' | 'quiz' | 'result';

/** Пауза перед автопереходом — чтобы участник увидел, что выбор засчитан. */
const AUTO_ADVANCE_DELAY_MS = 320;

export function createApp(root: HTMLElement, dataset: Dataset): void {
  const answers = new Map<string, Answer>();
  let screen: Screen = 'welcome';
  let index = 0;
  let quiz: QuizView | null = null;
  let autoAdvanceTimer: number | undefined;

  function cancelAutoAdvance(): void {
    if (autoAdvanceTimer === undefined) return;
    window.clearTimeout(autoAdvanceTimer);
    autoAdvanceTimer = undefined;
  }

  function currentQuestion(): Question {
    return dataset.questions[index];
  }

  function isAnswered(): boolean {
    return answers.has(currentQuestion().id);
  }

  function goPrev(): void {
    cancelAutoAdvance();
    if (index === 0) return;
    index -= 1;
    update();
  }

  function goNext(): void {
    cancelAutoAdvance();
    // Запрет перехода дальше без ответа — дублируем проверку здесь,
    // чтобы её нельзя было обойти горячей клавишей.
    if (!isAnswered()) return;

    if (index === dataset.questions.length - 1) {
      screen = 'result';
    } else {
      index += 1;
    }
    update();
  }

  function handleAnswer(question: Question, value: Answer, fromPointer: boolean): void {
    const wasAnswered = answers.has(question.id);
    answers.set(question.id, value);
    quiz?.setAnswered(true);

    const isLast = index === dataset.questions.length - 1;
    if (!wasAnswered && fromPointer && !isLast) {
      cancelAutoAdvance();
      autoAdvanceTimer = window.setTimeout(() => {
        autoAdvanceTimer = undefined;
        goNext();
      }, AUTO_ADVANCE_DELAY_MS);
    }
  }

  function start(): void {
    index = 0;
    screen = 'quiz';
    update();
  }

  function restart(): void {
    cancelAutoAdvance();
    answers.clear();
    index = 0;
    screen = 'welcome';
    update();
  }

  function update(): void {
    quiz = null;

    if (screen === 'welcome') {
      render(root, renderWelcome(dataset, start));
    } else if (screen === 'quiz') {
      quiz = renderQuiz({
        dataset,
        index,
        answers,
        onAnswer: handleAnswer,
        onPrev: goPrev,
        onNext: goNext,
      });
      render(root, quiz.element);
    } else {
      render(root, renderResult(evaluateAnswers(Object.fromEntries(answers), dataset), restart));
    }

    afterRender();
  }

  function afterRender(): void {
    const target = root.querySelector<HTMLElement>('[data-autofocus]');
    // preventScroll — чтобы страница не «прыгала», в том числе внутри iframe.
    target?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'auto' });
    reportHeight();
  }

  /** Горячие клавиши 1–4 для выбора варианта ответа. */
  function handleKeyDown(event: KeyboardEvent): void {
    if (screen !== 'quiz' || !quiz) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const digit = Number(event.key);
    if (!Number.isInteger(digit)) return;

    const optionIndex = digit - 1;
    if (optionIndex < 0 || optionIndex >= currentQuestion().options.length) return;

    event.preventDefault();
    quiz.selectOption(optionIndex);
  }

  /**
   * Сообщаем родительской странице высоту — чтобы при встраивании через iframe
   * его можно было подогнать под содержимое. Сообщение необязательное:
   * если родитель его игнорирует, тест работает как обычно.
   */
  function reportHeight(): void {
    if (window.parent === window) return;
    const height = Math.ceil(document.documentElement.scrollHeight);
    window.parent.postMessage({ type: 'nto-test:height', height }, '*');
  }

  document.addEventListener('keydown', handleKeyDown);
  window.addEventListener('resize', reportHeight);

  update();
}
