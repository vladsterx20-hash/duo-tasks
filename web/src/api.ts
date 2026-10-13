import WebApp from '@twa-dev/sdk';
import type { AppNotification, GeoResult, Settings, Status, Task, User } from './types';

/** Связь с ботом: может ли он писать пользователю в чат Telegram */
export interface TgStatus {
  ok: boolean;
  reason?: 'not_started' | 'blocked' | 'error';
  message?: string;
  bot?: string;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function headers(): Record<string, string> {
  if (WebApp.initData) return { Authorization: `tma ${WebApp.initData}` };
  const dev = import.meta.env.VITE_DEV_USER as string | undefined;
  return dev ? { 'x-dev-user': dev } : {};
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch('/api' + path, { ...init, headers: { ...headers(), ...(init.headers || {}) } });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError(0, 'Нет связи с сервером. Проверьте интернет.');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error || 'Ошибка запроса');
  return body as T;
}

const json = (method: string, data: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});

export const api = {
  me: () => req<{ me: User; users: User[]; settings: Settings }>('/me'),
  saveSettings: (s: Partial<Settings>) => req<Settings>('/settings', json('PUT', s)),
  tasks: () => req<Task[]>('/tasks'),
  create: (fd: FormData) => req<Task>('/tasks', { method: 'POST', body: fd }),
  update: (id: number, fd: FormData) => req<Task>(`/tasks/${id}`, { method: 'PATCH', body: fd }),
  setStatus: (id: number, status: Status, extra?: { profit?: number; price?: number; cost?: number }) =>
    req<Task>(`/tasks/${id}/status`, json('POST', { status, ...extra })),
  addFiles: (id: number, fd: FormData) => req<Task>(`/tasks/${id}/files`, { method: 'POST', body: fd }),
  addComment: (id: number, text: string) => req<Task>(`/tasks/${id}/comments`, json('POST', { text })),
  addChatMessage: (id: number, text: string) => req<Task>(`/tasks/${id}/chat`, json('POST', { text })),
  deleteComment: (id: number, cid: number) => req<Task>(`/tasks/${id}/comments/${cid}`, { method: 'DELETE' }),
  remove: (id: number) => req<{ ok: true }>(`/tasks/${id}`, { method: 'DELETE' }),
  notifyStatus: () => req<TgStatus>('/notify-status'),
  notifyTest: () => req<TgStatus>('/notify-test', { method: 'POST' }),
  notifications: () => req<{ items: AppNotification[]; unread: number }>('/notifications'),
  readNotifications: () => req<{ ok: true }>('/notifications/read', { method: 'POST' }),
  geocode: (q: string, signal?: AbortSignal) => req<GeoResult[]>(`/geocode?q=${encodeURIComponent(q)}`, { signal }),
  reverse: (lat: number, lng: number) => req<{ label: string } | null>(`/reverse?lat=${lat}&lng=${lng}`),
};
