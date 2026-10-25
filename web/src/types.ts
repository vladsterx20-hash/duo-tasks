export interface User {
  id: number;
  first_name: string;
  username: string | null;
  photo_url: string | null;
}

export interface Attachment {
  id: number;
  file_name: string;
  file_type: string;
  size: number;
  file_url: string;
}

export type Status = 'new' | 'in_progress' | 'done';
/** Вкладки списка задач (завершённые вынесены на главную) */
export type ActiveTab = 'new' | 'in_progress';
export type Period = 'week' | 'month' | 'all';
export type Priority = 'low' | 'normal' | 'high';
export type Theme = 'dark' | 'light';
export type Accent = 'orange' | 'red' | 'yellow' | 'green' | 'blue' | 'purple' | 'mono';

export const PRIORITY_LABEL: Record<Priority, string> = { low: 'Низкий', normal: 'Обычный', high: 'Высокий' };
export const PRIORITY_WEIGHT: Record<Priority, number> = { low: 0, normal: 1, high: 2 };

export interface Comment {
  id: number;
  author_id: number;
  text: string;
  created_at: string;
  /** файлы, отправленные вместе с этим сообщением (они же в «Файлах» задачи) */
  attachments?: Attachment[];
}

export interface Task {
  id: number;
  title: string;
  description: string;
  due_at: string | null;
  status: Status;
  author_id: number;
  /** null = оба */
  assignee_id: number | null;
  created_at: string;
  completed_at: string | null;
  attachments: Attachment[];
  priority: Priority;
  comments: Comment[];
  /** Переписка в разделе «Чат» (отдельно от комментариев в карточке задачи) */
  chat: Comment[];
  price: number;
  cost: number;
  /** фиксируется при завершении */
  profit: number | null;
  address: string;
  customer: string;
  lat: number | null;
  lng: number | null;
  taken_by: number | null;
}

export interface Settings {
  remind_minutes: number;
  n_assigned: boolean;
  n_taken: boolean;
  n_done: boolean;
  n_comment: boolean;
  n_chat: boolean;
  n_remind: boolean;
  theme: Theme;
  accent: Accent;
}

export interface AppNotification {
  id: number;
  kind: 'assigned' | 'taken' | 'done' | 'comment' | 'chat';
  task_id: number | null;
  text: string;
  read: boolean;
  created_at: string;
}

export interface GeoResult {
  label: string;
  lat: number;
  lng: number;
}

export type AssigneeChoice = 'me' | 'partner' | 'both';

/** Ручная операция с общим резервом */
export interface ReserveEntry {
  id: number;
  kind: 'add' | 'withdraw';
  amount: number;
  note: string;
  author_id: number;
  created_at: string;
}

/** Свой порядок задач на главной (id по порядку) */
export interface HomeOrder {
  pinned: number[];
  upcoming: number[];
}
