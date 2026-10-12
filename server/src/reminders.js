import { pool } from './db.js';
import { ALLOWED, REMIND_MINUTES } from './config.js';
import { notifyReminder } from './bot.js';

async function tick() {
  // Помечаем и забираем атомарно, чтобы не слать дубли
  const { rows } = await pool.query(
    `update tasks set reminded = true
     where status = 'new' and not reminded and due_at is not null
       and due_at <= now() + make_interval(mins => $1)
       and due_at > now() - interval '1 hour'
     returning id, title, due_at, assignee_id`,
    [REMIND_MINUTES]
  );
  for (const t of rows) {
    const targets = t.assignee_id ? [t.assignee_id] : ALLOWED;
    await Promise.all(targets.map((id) => notifyReminder(id, t)));
  }
}

export function startReminders() {
  const run = () => tick().catch((e) => console.error('reminders:', e.message));
  run();
  setInterval(run, 60_000);
}
