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

export interface Task {
  id: number;
  title: string;
  description: string;
  due_at: string | null;
  status: 'new' | 'done';
  author_id: number;
  /** null = оба */
  assignee_id: number | null;
  created_at: string;
  completed_at: string | null;
  attachments: Attachment[];
}

export type AssigneeChoice = 'me' | 'partner' | 'both';
