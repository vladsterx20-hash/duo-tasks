import { pool } from './db.js';
import { notifyReminder } from './bot.js';

async function tick() {
  // Для каждого исполнителя свой порог (users.remind_minutes).
  // Вставка в reminders_sent атомарна: одна пара «задача + пользователь» не сработает дважды.
  const { rows } = await pool.query(
    `with ins as (
       insert into reminders_sent (task_id, user_id)
       select t.id, u.id
       from tasks t
       join users u on (t.assignee_id is null or t.assignee_id = u.id)
       where t.status = 'new' and t.due_at is not null and u.n_remind
         and t.due_at <= now() + make_interval(mins => u.remind_minutes)
         and t.due_at > now() - interval '1 hour'
       on conflict do nothing
       returning task_id, user_id
     )
     select ins.user_id, t.id, t.title, t.due_at from ins join tasks t on t.id = ins.task_id`
  );
  await Promise.all(rows.map((r) => notifyReminder(r.user_id, r)));
}

export function startReminders() {
  const run = () => tick().catch((e) => console.error('reminders:', e.message));
  run();
  setInterval(run, 60_000);
}
