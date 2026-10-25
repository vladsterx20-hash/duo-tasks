import pg from 'pg';
import { ALLOWED } from './config.js';

pg.types.setTypeParser(20, Number); // bigint -> number (Telegram ID помещаются в 2^53)
pg.types.setTypeParser(1700, parseFloat); // numeric (деньги) -> number

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
    -- Две независимые переписки по задаче: 'comment' (в карточке задачи) и 'chat' (раздел «Чат»)
    alter table comments add column if not exists kind text not null default 'comment';
    alter table comments drop constraint if exists comments_kind_check;
    alter table comments add constraint comments_kind_check check (kind in ('comment','chat'));
    alter table users add column if not exists n_chat boolean not null default true;
    alter table users add column if not exists remind_minutes int not null default 30;
    alter table users add column if not exists n_assigned boolean not null default true;
    alter table users add column if not exists n_done boolean not null default true;
    alter table users add column if not exists n_comment boolean not null default true;
    alter table users add column if not exists n_remind boolean not null default true;
    -- v3: статус «в работу», деньги, адрес с координатами, тема, уведомления внутри приложения
    alter table tasks drop constraint if exists tasks_status_check;
    alter table tasks add constraint tasks_status_check check (status in ('new','in_progress','done'));
    alter table tasks add column if not exists price numeric(14,2) not null default 0;
    alter table tasks add column if not exists cost numeric(14,2) not null default 0;
    alter table tasks add column if not exists profit numeric(14,2);
    alter table tasks add column if not exists address text not null default '';
    alter table tasks add column if not exists lat double precision;
    alter table tasks add column if not exists lng double precision;
    alter table tasks add column if not exists customer text not null default '';
    alter table tasks add column if not exists taken_by bigint references users(id);
    alter table users add column if not exists theme text not null default 'dark';
    alter table users add column if not exists n_taken boolean not null default true;
    create table if not exists notifications (
      id serial primary key,
      user_id bigint not null references users(id),
      kind text not null,
      task_id int references tasks(id) on delete set null,
      text text not null,
      read boolean not null default false,
      created_at timestamptz not null default now()
    );
    create index if not exists notifications_user_idx on notifications(user_id, id desc);
    -- Цвет интерфейса и файлы, отправленные в чат (привязаны к сообщению, а не к задаче)
    alter table users add column if not exists accent text not null default 'orange';
    alter table attachments add column if not exists comment_id int references comments(id) on delete cascade;
    create index if not exists attachments_comment_idx on attachments(comment_id);
    -- Ручные операции с «Общим резервом»: пополнение и расход (с назначением)
    create table if not exists reserve_entries (
      id serial primary key,
      kind text not null check (kind in ('add','withdraw')),
      amount numeric(14,2) not null check (amount > 0),
      note text not null default '',
      author_id bigint not null references users(id),
      created_at timestamptz not null default now()
    );
    -- Закреплённые задачи: у каждого пользователя свои
    create table if not exists task_pins (
      user_id bigint not null references users(id),
      task_id int not null references tasks(id) on delete cascade,
      created_at timestamptz not null default now(),
      primary key (user_id, task_id)
    );
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
