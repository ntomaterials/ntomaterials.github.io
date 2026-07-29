/** Экран приветствия. */

import type { Dataset } from '../types';
import { h, plural } from './dom';

/** Средний темп прохождения — примерно 12 секунд на вопрос. */
const SECONDS_PER_QUESTION = 12;

function estimateMinutes(questionCount: number): number {
  return Math.max(1, Math.round((questionCount * SECONDS_PER_QUESTION) / 60));
}

export function renderWelcome(dataset: Dataset, onStart: () => void): HTMLElement {
  const { meta } = dataset;
  const minutes = estimateMinutes(meta.questionCount);

  const facts: readonly { value: string; label: string }[] = [
    {
      value: String(meta.questionCount),
      label: plural(meta.questionCount, 'вопрос', 'вопроса', 'вопросов'),
    },
    { value: `~${minutes}`, label: plural(minutes, 'минута', 'минуты', 'минут') },
    {
      value: String(meta.profileCount),
      label: plural(meta.profileCount, 'профиль', 'профиля', 'профилей'),
    },
  ];

  return h(
    'section',
    { class: 'screen screen--welcome', 'aria-labelledby': 'welcome-title' },
    h('p', { class: 'eyebrow', text: 'Национальная технологическая олимпиада' }),
    h('h1', { id: 'welcome-title', class: 'title', text: 'Какой профиль НТО тебе подходит?' }),
    h('p', {
      class: 'lead',
      text:
        'Ответь на несколько вопросов о том, что тебе интересно и чем нравится заниматься. ' +
        'В конце получишь три профиля олимпиады, которые ближе всего к твоим ответам, ' +
        'с объяснением, почему они подходят.',
    }),

    h(
      'ul',
      { class: 'facts', role: 'list' },
      ...facts.map((fact) =>
        h(
          'li',
          { class: 'facts__item' },
          h('span', { class: 'facts__value', text: fact.value }),
          h('span', { class: 'facts__label', text: fact.label }),
        ),
      ),
    ),

    h(
      'button',
      { class: 'button button--primary button--lg', type: 'button', onclick: onStart },
      'Начать тест',
    ),

    h(
      'p',
      { class: 'note' },
      'Регистрация не нужна, ответы никуда не отправляются и нигде не сохраняются — ' +
        'весь расчёт идёт прямо в твоём браузере.',
    ),
  );
}
