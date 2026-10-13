import WebApp from '@twa-dev/sdk';
import type { Theme } from './types';

export function initialTheme(): Theme {
  try {
    const v = localStorage.getItem('theme');
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* localStorage недоступен */
  }
  return 'dark';
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem('theme', theme);
  } catch {
    /* ignore */
  }
  try {
    const color = theme === 'dark' ? '#111111' : '#f2f2f5';
    WebApp.setHeaderColor(color);
    WebApp.setBackgroundColor(color);
  } catch {
    /* вне Telegram */
  }
}
