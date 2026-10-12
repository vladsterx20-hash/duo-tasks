import { Bot, InlineKeyboard } from 'grammy';
import { BOT_TOKEN, APP_URL, TIMEZONE } from './config.js';

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

export async function notify(userId, html) {
  try {
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
    `📝 <b>${esc(authorName)}</b> назначил(а) вам задачу:\n<b>${esc(task.title)}</b>\nСрок: ${fmtDate(task.due_at)}`
  );

export const notifyReminder = (userId, task) =>
  notify(userId, `⏰ Скоро срок задачи:\n<b>${esc(task.title)}</b>\nСрок: ${fmtDate(task.due_at)}`);
