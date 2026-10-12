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

export const isOverdue = (t: Task) => t.status === 'new' && !!t.due_at && new Date(t.due_at).getTime() < Date.now();

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

export function openFile(path: string) {
  const url = location.origin + path;
  if (inTelegram()) WebApp.openLink(url);
  else window.open(url, '_blank');
}
