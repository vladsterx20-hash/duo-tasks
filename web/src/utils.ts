import WebApp from '@twa-dev/sdk';
import type { Task, User } from './types';

export const inTelegram = () => Boolean(WebApp.initData);

export function fmtDue(iso: string | null): string {
  if (!iso) return 'Без срока';
  const d = new Date(iso);
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOfDay(d) - startOfDay(new Date())) / 86_400_000);
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  if (diff === 0) return `Сегодня, ${time}`;
  if (diff === 1) return `Завтра, ${time}`;
  if (diff === -1) return `Вчера, ${time}`;
  return d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export const isOverdue = (t: Task) => t.status !== 'done' && !!t.due_at && new Date(t.due_at).getTime() < Date.now();

export const fmtMoney = (n: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n) + ' ₽';

/** Только цифры и одна точка, до 2 знаков после неё (отрицательных нет) */
export function cleanMoney(s: string): string {
  let out = s.replace(',', '.').replace(/[^0-9.]/g, '');
  const i = out.indexOf('.');
  if (i >= 0) out = out.slice(0, i + 1) + out.slice(i + 1).replace(/\./g, '');
  return out.replace(/^(\d*\.\d{0,2}).*$/, '$1').slice(0, 12);
}

/** То же, но допускает ведущий минус (сумма прибыли при завершении) */
export function cleanSignedMoney(s: string): string {
  const neg = s.trim().startsWith('-');
  return (neg ? '-' : '') + cleanMoney(s);
}

export const toNum = (s: string): number => {
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

export const statusLabel = { new: 'Новая', in_progress: 'В работе', done: 'Завершена' } as const;

/** ISO -> значение для <input type="datetime-local"> в локальной зоне */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fmtSize(n: number): string {
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} КБ`;
  return `${(n / 1024 / 1024).toFixed(1)} МБ`;
}

export const assigneesOf = (t: Task, users: User[]): User[] =>
  t.assignee_id === null ? users : users.filter((u) => u.id === t.assignee_id);

export const haptic = (kind: 'light' | 'success' = 'light') => {
  try {
    if (kind === 'success') WebApp.HapticFeedback.notificationOccurred('success');
    else WebApp.HapticFeedback.impactOccurred('light');
  } catch {
    /* вне Telegram */
  }
};

export function openUrl(url: string) {
  if (inTelegram()) WebApp.openLink(url);
  else window.open(url, '_blank');
}

export const openFile = (path: string) => openUrl(location.origin + path);

/** Маршрут до точки (бесплатная ссылка, без ключей) */
export const openRoute = (lat: number, lng: number) =>
  openUrl(`https://yandex.ru/maps/?rtext=~${lat},${lng}&rtt=auto`);
