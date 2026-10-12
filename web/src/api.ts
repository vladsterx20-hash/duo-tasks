import WebApp from '@twa-dev/sdk';
import type { Task, User } from './types';

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
  const res = await fetch('/api' + path, { ...init, headers: { ...headers(), ...(init.headers || {}) } });
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
  me: () => req<{ me: User; users: User[] }>('/me'),
  tasks: () => req<Task[]>('/tasks'),
  create: (fd: FormData) => req<Task>('/tasks', { method: 'POST', body: fd }),
  update: (id: number, fd: FormData) => req<Task>(`/tasks/${id}`, { method: 'PATCH', body: fd }),
  setStatus: (id: number, status: 'new' | 'done') => req<Task>(`/tasks/${id}/status`, json('POST', { status })),
  remove: (id: number) => req<{ ok: true }>(`/tasks/${id}`, { method: 'DELETE' }),
};
