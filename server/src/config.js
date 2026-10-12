import 'dotenv/config';

export const BOT_TOKEN = process.env.BOT_TOKEN || '';
export const ALLOWED = (process.env.ALLOWED_IDS || '')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter(Boolean);
export const APP_URL = process.env.APP_URL || '';
export const TIMEZONE = process.env.TIMEZONE || 'Europe/Moscow';
export const REMIND_MINUTES = Number(process.env.REMIND_MINUTES || 30);
export const DEV_BYPASS = process.env.DEV_BYPASS === 'true' && process.env.NODE_ENV !== 'production';
export const MAX_FILE = 20 * 1024 * 1024;

if (!BOT_TOKEN) throw new Error('BOT_TOKEN не задан');
if (ALLOWED.length !== 2) throw new Error('ALLOWED_IDS должен содержать ровно два Telegram ID');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL не задан');
