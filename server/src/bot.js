import { Bot, InlineKeyboard } from 'grammy';
import { BOT_TOKEN, APP_URL, TIMEZONE } from './config.js';
import { pool } from './db.js';

export const bot = new Bot(BOT_TOKEN);

const openKb = () => new InlineKeyboard().webApp('Открыть приложение', APP_URL);

bot.command('start', (ctx) =>
  ctx.reply('Привет! Это ваш общий трекер задач 📝', { reply_markup: openKb() })
);

export async function startBot() {
  bot.catch((err) => console.error('Bot error:', err.message));
  if (APP_URL) {
    await bot.api
      .setChatMenuButton({ menu_button: { type: 'web_app', text: 'Задачи', web_app: { url: APP_URL } } })
      .catch((e) => console.error('setChatMenuButton:', e.message));
  }
  bot.start({ drop_pending_updates: true }).catch((e) => console.error('Bot stopped:', e.message));
}

export const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleString('ru-RU', {
        timeZone: TIMEZONE,
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'без срока';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const KIND_COLUMN = { assigned: 'n_assigned', done: 'n_done', comment: 'n_comment', remind: 'n_remind' };

export async function notify(userId, html, kind) {
  try {
    if (kind) {
      const { rows } = await pool.query(`select ${KIND_COLUMN[kind]} as enabled from users where id=$1`, [userId]);
      if (rows[0] && !rows[0].enabled) return; // пользователь отключил этот тип уведомлений
    }
    await bot.api.sendMessage(userId, html, {
      parse_mode: 'HTML',
      reply_markup: APP_URL ? openKb() : undefined,
    });
  } catch (e) {
    // Пользователь мог не нажать /start у бота — тогда писать ему нельзя
    console.warn(`Не удалось отправить уведомление ${userId}: ${e.message}`);
  }
}

export const notifyAssigned = (userId, authorName, task) =>
  notify(
    userId,
    `📝 <b>${esc(authorName)}</b> назначил(а) вам задачу:\n<b>${esc(task.title)}</b>\n` +
      (task.priority === 'high' ? '🔥 Важная\n' : '') +
      `Срок: ${fmtDate(task.due_at)}`,
    'assigned'
  );

export const notifyDone = (userId, name, task) =>
  notify(userId, `✅ <b>${esc(name)}</b> выполнил(а) задачу:\n<b>${esc(task.title)}</b>`, 'done');

export const notifyComment = (userId, name, task, text) =>
  notify(
    userId,
    `💬 <b>${esc(name)}</b> прокомментировал(а) «${esc(task.title)}»:\n${esc(text.length > 300 ? text.slice(0, 300) + '…' : text)}`,
    'comment'
  );

export const notifyReminder = (userId, task) =>
  notify(userId, `⏰ Скоро срок задачи:\n<b>${esc(task.title)}</b>\nСрок: ${fmtDate(task.due_at)}`, 'remind');
