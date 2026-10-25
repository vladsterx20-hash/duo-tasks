import WebApp from '@twa-dev/sdk';
import type { Accent, Theme } from './types';

/** Акцентные цвета интерфейса. swatch — цвет кружка в настройках, сами цвета лежат в styles.css (data-accent) */
export const ACCENTS: { key: Accent; label: string; swatch: string }[] = [
  { key: 'orange', label: 'Оранжевый', swatch: '#f26b1d' },
  { key: 'red', label: 'Красный', swatch: '#f0494c' },
  { key: 'yellow', label: 'Жёлтый', swatch: '#f5b700' },
  { key: 'green', label: 'Зелёный', swatch: '#2fb768' },
  { key: 'blue', label: 'Синий', swatch: '#4d94ff' },
  { key: 'purple', label: 'Фиолетовый', swatch: '#a98bff' },
  { key: 'mono', label: 'Белый', swatch: '#ffffff' },
];

const ACCENT_KEYS = ACCENTS.map((a) => a.key);

export function initialTheme(): Theme {
  try {
    const v = localStorage.getItem('theme');
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* localStorage недоступен */
  }
  return 'dark';
}

export function initialAccent(): Accent {
  try {
    const v = localStorage.getItem('accent') as Accent | null;
    if (v && ACCENT_KEYS.includes(v)) return v;
  } catch {
    /* localStorage недоступен */
  }
  return 'orange';
}

/** Текущий акцентный цвет и цвет текста на нём (для кнопок Telegram) */
export function accentColors(): { color: string; text: string } {
  const cs = getComputedStyle(document.documentElement);
  return { color: cs.getPropertyValue('--accent').trim() || '#f26b1d', text: cs.getPropertyValue('--accent-text').trim() || '#111111' };
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem('theme', theme);
  } catch {
    /* ignore */
  }
  paintChrome(theme);
  // Telegram на телефоне иногда игнорирует цвет шапки, заданный в первый момент запуска: повторяем, когда окно уже раскрыто
  setTimeout(() => paintChrome(theme), 400);
  setTimeout(() => paintChrome(theme), 1800);
}

/** Цвет шапки Telegram (там же кружки «закрыть» и «⋯»), фона и нижней полосы — под нашу тему */
function paintChrome(theme: Theme) {
  const color = theme === 'dark' ? '#111111' : '#f2f2f5';
  try {
    WebApp.setHeaderColor(color);
    WebApp.setBackgroundColor(color);
  } catch {
    /* вне Telegram */
  }
  try {
    WebApp.setBottomBarColor(color);
  } catch {
    /* старые версии Telegram */
  }
}

// Если пользователь сменил тему самого Telegram, возвращаем цвета шапки под тему приложения
try {
  WebApp.onEvent('themeChanged', () => paintChrome((document.documentElement.dataset.theme as Theme) || 'dark'));
} catch {
  /* вне Telegram */
}

export function applyAccent(accent: Accent) {
  document.documentElement.dataset.accent = ACCENT_KEYS.includes(accent) ? accent : 'orange';
  try {
    localStorage.setItem('accent', accent);
  } catch {
    /* ignore */
  }
}
