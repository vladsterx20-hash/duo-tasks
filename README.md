# Duo Tasks — Telegram Mini App для двоих

## Архитектура

```
Telegram ──► Mini App (React + Vite + TS, @twa-dev/sdk)
                │  Authorization: tma <initData>
                ▼
        Express API  ──► Postgres (users, tasks, attachments[bytea])
        + grammY бот (long polling, уведомления)
        + напоминания (таймер раз в минуту)
        + раздача собранного фронтенда
```

**Почему Express + Postgres, а не Supabase.** Серверу всё равно нужно проверять подпись `initData`
и держать бота, поэтому свой сервис обязателен. Файлы (≤20 МБ, два пользователя) хранятся прямо
в Postgres (`bytea`) — не нужны ни отдельное хранилище, ни диск. Итог: **один веб-сервис + одна база**.
Файлы отдаются по подписанной ссылке (`/api/files/:id?t=<HMAC>`), чтобы работали `<img>` и открытие в браузере.

```
server/src
  config.js     переменные окружения
  db.js         схема БД, заготовки для 2 пользователей
  auth.js       проверка HMAC initData, белый список, авторегистрация
  routes.js     REST API (задачи, файлы)
  bot.js        grammY: /start, кнопка WebApp, уведомления
  reminders.js  напоминания перед сроком
  index.js      запуск
web/src
  App.tsx       вкладки, список, pull-to-refresh, навигация
  components/   TaskCard (свайп), TaskForm (MainButton), TaskDetail, Avatar
```

`tasks.assignee_id = NULL` означает «оба исполнителя».

## Пошаговая настройка

### 1. Бот в @BotFather
1. `/newbot` → имя и username → получите **BOT_TOKEN**.
2. Узнайте свой и партнёра Telegram ID через @userinfobot → **ALLOWED_IDS**=`id1,id2`.
3. **Важно:** оба должны один раз нажать `/start` у бота, иначе бот не сможет присылать уведомления.

### 2. База данных
Создайте бесплатную Postgres: [Neon](https://neon.tech), Supabase или плагин Render/Railway.
Скопируйте строку подключения и добавьте `?sslmode=require` для облачных баз → **DATABASE_URL**.
Таблицы создаются автоматически при первом запуске.

### 3. Деплой (Render или Railway)
Репозиторий на GitHub (корень = эта папка), затем:

**Render** → New → Web Service:
- Build Command: `npm run build`
- Start Command: `npm start`
- Environment: `BOT_TOKEN`, `ALLOWED_IDS`, `DATABASE_URL`, `APP_URL`, `TIMEZONE`, `REMIND_MINUTES`

**Railway** → New Project → Deploy from GitHub; те же переменные; Build `npm run build`, Start `npm start`.

`APP_URL` = публичный HTTPS-адрес сервиса (например `https://duo-tasks.onrender.com`) — задайте после первого деплоя и перезапустите.
Запускайте **ровно один экземпляр** (бот работает через long polling).
На бесплатном Render сервис «засыпает» — напоминания не придут, пока он спит; используйте платный тариф или Railway.
Vercel не подходит: серверу нужен постоянно работающий процесс.

### 4. Подключение Mini App в @BotFather
- `/newapp` (или `/mybots` → бот → Bot Settings → Configure Mini App / Menu Button) → укажите URL = `APP_URL`.
- Кнопка меню «Задачи» ставится ботом автоматически при старте; в `/start` приходит кнопка «Открыть приложение».

### 5. Локальная разработка
```bash
cp .env.example .env        # заполните; для проверки в браузере: DEV_BYPASS=true
npm install --prefix server && npm install --prefix web
npm run dev:server          # :3000
VITE_DEV_USER=<ваш id> npm run dev:web
```
Для теста внутри Telegram нужен HTTPS-туннель (ngrok / cloudflared) → его адрес в `APP_URL`.

## Безопасность
- Каждый запрос подписан `initData`; сервер проверяет HMAC (ключ `HMAC("WebAppData", BOT_TOKEN)`), давность ≤24 ч и белый список ID.
- `DEV_BYPASS` игнорируется при `NODE_ENV=production`.
