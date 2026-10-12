import pg from 'pg';
import { ALLOWED } from './config.js';

pg.types.setTypeParser(20, Number); // bigint -> number (Telegram ID помещаются в 2^53)

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export async function initDb() {
  await pool.query(`
    create table if not exists users (
      id bigint primary key,
      first_name text not null,
      username text,
      photo_url text,
      created_at timestamptz not null default now()
    );
    create table if not exists tasks (
      id serial primary key,
      title text not null,
      description text not null default '',
      due_at timestamptz,
      status text not null default 'new' check (status in ('new','done')),
      author_id bigint not null references users(id),
      assignee_id bigint references users(id), -- NULL = оба
      reminded boolean not null default false,
      created_at timestamptz not null default now(),
      completed_at timestamptz
    );
    create table if not exists attachments (
      id serial primary key,
      task_id int not null references tasks(id) on delete cascade,
      file_name text not null,
      file_type text not null,
      size int not null,
      data bytea not null,
      created_at timestamptz not null default now()
    );
    alter table tasks add column if not exists priority text not null default 'normal'
      check (priority in ('low','normal','high'));
    create table if not exists comments (
      id serial primary key,
      task_id int not null references tasks(id) on delete cascade,
      author_id bigint not null references users(id),
      text text not null,
      created_at timestamptz not null default now()
    );
    create index if not exists comments_task_idx on comments(task_id);
    alter table users add column if not exists remind_minutes int not null default 30;
    alter table users add column if not exists n_assigned boolean not null default true;
    alter table users add column if not exists n_done boolean not null default true;
    alter table users add column if not exists n_comment boolean not null default true;
    alter table users add column if not exists n_remind boolean not null default true;
    create table if not exists reminders_sent (
      task_id int not null references tasks(id) on delete cascade,
      user_id bigint not null references users(id),
      primary key (task_id, user_id)
    );
    create index if not exists tasks_status_idx on tasks(status);
    create index if not exists attachments_task_idx on attachments(task_id);
  `);
  // Заготовки для обоих пользователей: чтобы можно было назначать задачи ещё до первого входа партнёра
  for (const id of ALLOWED) {
    await pool.query(
      `insert into users (id, first_name) values ($1, 'Партнёр') on conflict (id) do nothing`,
      [id]
    );
  }
}
