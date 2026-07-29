/** Экран результата: топ-3 профиля, предупреждения, полный рейтинг. */

import { cautionText } from '../scoring';
import type { ComponentHighlight, ProfileResult, TestResult } from '../scoring/types';
import { h, plural } from './dom';

const RANK_LABEL = ['Лучшее совпадение', 'Второе место', 'Третье место'];

/** Роль темы в профиле — по весу из матрицы. */
function weightLabel(weight: number): string {
  if (weight >= 3) return 'ядро профиля';
  if (weight === 2) return 'важно для профиля';
  return 'сопутствующая тема';
}

function renderStrength(strength: ComponentHighlight): HTMLElement {
  return h(
    'li',
    { class: 'chip' },
    h('span', { class: 'chip__name', text: strength.name }),
    h('span', { class: 'chip__role', text: weightLabel(strength.profileWeight) }),
  );
}

function renderCard(result: ProfileResult, rank: number): HTMLElement {
  return h(
    'article',
    { class: `card card--rank-${rank + 1}` },

    h(
      'header',
      { class: 'card__header' },
      h(
        'div',
        { class: 'card__rank' },
        h('span', { class: 'card__rank-number', text: String(rank + 1) }),
        h('span', { class: 'card__rank-label', text: RANK_LABEL[rank] ?? `Место ${rank + 1}` }),
      ),
      h('h3', { class: 'card__title', text: result.fullName }),
      h('p', { class: 'card__code', text: `Код профиля: ${result.code}` }),
    ),

    h(
      'div',
      { class: 'match' },
      h(
        'div',
        { class: 'match__row' },
        h('span', { class: 'match__label', text: 'Совпадение' }),
        h('span', { class: 'match__value', text: `${result.matchPercent}%` }),
      ),
      h(
        'div',
        {
          class: 'match__track',
          role: 'img',
          'aria-label': `Совпадение с профилем — ${result.matchPercent} процентов`,
        },
        h('div', { class: 'match__bar', style: `width: ${result.matchPercent}%` }),
      ),
    ),

    result.strengths.length > 0
      ? h(
          'div',
          { class: 'card__section' },
          h('h4', { class: 'card__section-title', text: 'Почему подходит' }),
          h('ul', { class: 'chips', role: 'list' }, ...result.strengths.map(renderStrength)),
        )
      : null,

    result.dominantActivity
      ? h(
          'div',
          { class: 'card__section' },
          h('h4', { class: 'card__section-title', text: 'Основной тип деятельности' }),
          h('p', { class: 'card__activity', text: result.dominantActivity }),
        )
      : null,

    ...result.cautions.map((caution) =>
      h('p', { class: 'caution', role: 'note' }, cautionText(caution.name)),
    ),
  );
}

function renderFullRanking(result: TestResult): HTMLElement {
  return h(
    'details',
    { class: 'disclosure' },
    h('summary', { class: 'disclosure__summary', text: 'Показать все профили' }),
    h(
      'ol',
      { class: 'ranking' },
      ...result.ranked.map((item) =>
        h(
          'li',
          { class: 'ranking__item' },
          h('span', { class: 'ranking__name', text: item.fullName }),
          h('span', { class: 'ranking__code', text: item.code }),
          h('span', { class: 'ranking__percent', text: `${item.matchPercent}%` }),
        ),
      ),
    ),
  );
}

export function renderResult(result: TestResult, onRestart: () => void): HTMLElement {
  const count = result.top.length;

  return h(
    'section',
    { class: 'screen screen--result', 'aria-labelledby': 'result-title' },

    h('p', { class: 'eyebrow', text: 'Результат' }),
    h('h1', {
      id: 'result-title',
      class: 'title',
      text: `Тебе ближе всего ${count} ${plural(count, 'профиль', 'профиля', 'профилей')}`,
      tabindex: '-1',
      'data-autofocus': 'true',
    }),

    result.warnings.length > 0
      ? h(
          'div',
          { class: 'warnings', role: 'status' },
          ...result.warnings.map((warning) => h('p', { class: 'warnings__item', text: warning })),
        )
      : null,

    h('div', { class: 'cards' }, ...result.top.map((item, rank) => renderCard(item, rank))),

    renderFullRanking(result),

    h(
      'details',
      { class: 'disclosure' },
      h('summary', { class: 'disclosure__summary', text: 'Как считается результат' }),
      h('p', {
        class: 'disclosure__text',
        text:
          `Методика: ${result.strategyTitle}. Ответы приводятся к общей шкале, ` +
          'из них собирается твой профиль интересов, который сравнивается с описанием ' +
          'каждого профиля олимпиады. Чем ближе описания, тем выше процент совпадения. ' +
          'Расчёт полностью выполняется в браузере — ответы никуда не отправляются.',
      }),
    ),

    h(
      'div',
      { class: 'nav nav--center' },
      h(
        'button',
        { class: 'button button--primary', type: 'button', onclick: onRestart },
        'Пройти тест заново',
      ),
    ),
  );
}
