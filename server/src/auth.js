import crypto from 'node:crypto';
import { BOT_TOKEN, ALLOWED, DEV_BYPASS } from './config.js';
import { pool } from './db.js';

const MAX_AGE_SEC = 24 * 60 * 60;

/** Проверка подписи initData (HMAC-SHA256 с ключом, производным от токена бота). */
export function verifyInitData(initData) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const calc = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

  const a = Buffer.from(calc, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const authDate = Number(params.get('auth_date'));
  if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_SEC) return null;

  try {
    return JSON.parse(params.get('user') || 'null');
  } catch {
    return null;
  }
}

/** Токен для ссылок на файлы (чтобы <img src> и openLink работали без заголовков). */
export function fileToken(id) {
  return crypto.createHmac('sha256', BOT_TOKEN).update(`file:${id}`).digest('hex').slice(0, 32);
}

export async function auth(req, res, next) {
  try {
    let tgUser = null;
    const header = req.headers.authorization || '';
    if (header.startsWith('tma ')) tgUser = verifyInitData(header.slice(4));
    else if (DEV_BYPASS && req.headers['x-dev-user']) {
      tgUser = { id: Number(req.headers['x-dev-user']), first_name: 'Dev ' + req.headers['x-dev-user'] };
    }
    if (!tgUser) return res.status(401).json({ error: 'unauthorized' });
    if (!ALLOWED.includes(tgUser.id)) return res.status(403).json({ error: 'forbidden' });

    // Автоматическая регистрация / обновление профиля из Telegram
    const { rows } = await pool.query(
      `insert into users (id, first_name, username, photo_url) values ($1,$2,$3,$4)
       on conflict (id) do update set first_name = excluded.first_name,
         username = excluded.username, photo_url = coalesce(excluded.photo_url, users.photo_url)
       returning id, first_name, username, photo_url`,
      [tgUser.id, tgUser.first_name || 'Без имени', tgUser.username || null, tgUser.photo_url || null]
    );
    req.user = rows[0];
    next();
  } catch (e) {
    next(e);
  }
}
