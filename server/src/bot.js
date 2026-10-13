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
  if (APP_URL && !/^https:\/\//i.test(APP_URL))
    console.warn(`APP_URL="${APP_URL}" — для кнопки приложения в Telegram нужен адрес вида https://…`);
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

const KIND_COLUMN = {
  assigned: 'n_assigned',
  taken: 'n_taken',
  done: 'n_done',
  comment: 'n_comment',
  chat: 'n_chat',
  remind: 'n_remind',
};

const errText = (e) => String(e?.description || e?.message || e);

/** Почему сообщение не дошло: бот не запущен у человека, заблокирован или другая ошибка */
function reasonOf(e) {
  const d = errText(e);
  if (/chat not found|can't initiate|cannot initiate/i.test(d)) return 'not_started';
  if (/blocked by the user|user is deactivated|bot was kicked/i.test(d)) return 'blocked';
  return 'error';
}

const send = (userId, html, withButton) =>
  bot.api.sendMessage(userId, html, { parse_mode: 'HTML', reply_markup: withButton ? openKb() : undefined });

/** Отправка в чат Telegram. Если кнопка «Открыть приложение» отвергнута (неверный адрес), шлём без неё. */
export async function deliver(userId, html) {
  try {
    await send(userId, html, !!APP_URL);
    return { ok: true };
  } catch (e) {
    if (APP_URL && /BUTTON|web_app|url/i.test(errText(e))) {
      try {
        await send(userId, html, false);
        console.warn('Кнопка WebApp отклонена Telegram — проверьте APP_URL (нужен https://…). Сообщение отправлено без кнопки.');
        return { ok: true, buttonSkipped: true };
      } catch (e2) {
        e = e2;
      }
    }
    console.warn(`Не удалось отправить сообщение ${userId}: ${errText(e)}`);
    return { ok: false, reason: reasonOf(e), message: errText(e) };
  }
}

/** Может ли бот написать этому человеку (без отправки сообщения) */
export async function canReach(userId) {
  try {
    await bot.api.sendChatAction(userId, 'typing');
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: reasonOf(e), message: errText(e) };
  }
}

let botName;
export async function botUsername() {
  if (!botName) {
    try {
      botName = (await bot.api.getMe()).username;
    } catch {
      /* без имени просто не покажем кнопку «Открыть бота» */
    }
  }
  return botName;
}

export async function notify(userId, html, kind) {
  try {
    if (kind) {
      const { rows } = await pool.query(`select ${KIND_COLUMN[kind]} as enabled from users where id=$1`, [userId]);
      if (rows[0] && !rows[0].enabled) return; // пользователь отключил этот тип уведомлений
    }
    return await deliver(userId, html);
  } catch (e) {
    console.warn(`Ошибка уведомления ${userId}: ${errText(e)}`);
  }
}

/** assignedToYou: задача назначена получателю; иначе просто сообщаем, что партнёр создал задачу */
export const notifyAssigned = (userId, authorName, task, assignedToYou = true) =>
  notify(
    userId,
    `📝 <b>${esc(authorName)}</b> ${assignedToYou ? 'назначил(а) вам задачу' : 'создал(а) задачу'}:\n<b>${esc(task.title)}</b>\n` +
      (task.priority === 'high' ? '🔥 Важная\n' : '') +
      `Срок: ${fmtDate(task.due_at)}`,
    'assigned'
  );

export const notifyTaken = (userId, name, task) =>
  notify(userId, `🛠 <b>${esc(name)}</b> взял(а) в работу:\n<b>${esc(task.title)}</b>`, 'taken');

export const notifyDone =(userId, name, task) =>
  notify(userId, `✅ <b>${esc(name)}</b> выполнил(а) задачу:\n<b>${esc(task.title)}</b>`, 'done');

export const notifyChat = (userId, name, task, text) =>
  notify(
    userId,
    `🗨 <b>${esc(name)}</b> в чате задачи «${esc(task.title)}»:\n${esc(text.length > 300 ? text.slice(0, 300) + '…' : text)}`,
    'chat'
  );

export const notifyComment = (userId, name, task, text) =>
  notify(
    userId,
    `💬 <b>${esc(name)}</b> прокомментировал(а) «${esc(task.title)}»:\n${esc(text.length > 300 ? text.slice(0, 300) + '…' : text)}`,
    'comment'
  );

export const notifyReminder = (userId, task) =>
  notify(userId, `⏰ Скоро срок задачи:\n<b>${esc(task.title)}</b>\nСрок: ${fmtDate(task.due_at)}`, 'remind');
