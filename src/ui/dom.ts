/**
 * Микро-хелперы для создания DOM.
 *
 * Фреймворк не используется намеренно: у теста три экрана и нет разделяемого
 * состояния между ними — React/Vue добавили бы к бандлу больше, чем весь
 * остальной код. Текст везде вставляется через textContent, innerHTML не
 * применяется вообще.
 */

export type Child = Node | string | null | undefined | false;

type Attributes = Record<string, unknown>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attributes = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;

    if (key === 'class') {
      element.className = String(value);
    } else if (key === 'text') {
      element.textContent = String(value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      element.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (value === true) {
      element.setAttribute(key, '');
    } else {
      element.setAttribute(key, String(value));
    }
  }

  append(element, children);
  return element;
}

export function append(parent: Node, children: readonly Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    parent.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
}

/** Заменяет содержимое контейнера. */
export function render(container: HTMLElement, ...children: Child[]): void {
  container.replaceChildren();
  append(container, children);
}

/** Склонение существительного: plural(29, 'вопрос', 'вопроса', 'вопросов'). */
export function plural(count: number, one: string, few: string, many: string): string {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
}
