import express from 'express';
import multer from 'multer';
import { pool } from './db.js';
import { auth, fileToken } from './auth.js';
import { ALLOWED, MAX_FILE } from './config.js';
import { notifyAssigned, notifyTaken, notifyDone, notifyComment, notifyChat, deliver, canReach, botUsername } from './bot.js';
import { geocode, reverseGeocode } from './geo.js';

export const api = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE, files: 10 } });
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
// multer читает имя файла как latin1
const fixName = (n) => Buffer.from(n, 'latin1').toString('utf8');

// ---------- файлы (доступ по подписанной ссылке) ----------
api.get(
  '/files/:id',
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    if (!id || req.query.t !== fileToken(id)) return res.status(403).end();
    const { rows } = await pool.query('select file_name, file_type, data from attachments where id=$1', [id]);
    if (!rows[0]) return res.status(404).end();
    const f = rows[0];
    const inline = /^(image\/(png|jpe?g|gif|webp)|application\/pdf)$/.test(f.file_type);
    res.setHeader('Content-Type', f.file_type);
    res.setHeader(
      'Content-Disposition',
      `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(f.file_name)}`
    );
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.send(f.data);
  })
);

api.use(auth);

// ---------- helpers ----------
const PRIORITIES = ['low', 'normal', 'high'];
const STATUSES = ['new', 'in_progress', 'done'];
const validPriority = (v) => (PRIORITIES.includes(v) ? v : undefined);

// Файлы задачи — только те, что не относятся к сообщению чата (comment_id is null)
const SELECT = `
  select t.id, t.title, t.description, t.due_at, t.status, t.priority, t.author_id, t.assignee_id,
         t.created_at, t.completed_at, t.price, t.cost, t.profit, t.address, t.lat, t.lng, t.customer, t.taken_by,
         coalesce((select json_agg(json_build_object('id',a.id,'file_name',a.file_name,'file_type',a.file_type,'size',a.size)
                   order by a.id) from attachments a where a.task_id = t.id and a.comment_id is null), '[]'::json) as attachments,
         coalesce((select json_agg(json_build_object('id',c.id,'author_id',c.author_id,'text',c.text,'created_at',c.created_at)
                   order by c.id) from comments c where c.task_id = t.id and c.kind = 'comment'), '[]'::json) as comments,
         coalesce((select json_agg(json_build_object('id',c.id,'author_id',c.author_id,'text',c.text,'created_at',c.created_at,
                   'attachments', coalesce((select json_agg(json_build_object('id',a.id,'file_name',a.file_name,'file_type',a.file_type,'size',a.size)
                                            order by a.id) from attachments a where a.comment_id = c.id), '[]'::json))
                   order by c.id) from comments c where c.task_id = t.id and c.kind = 'chat'), '[]'::json) as chat
  from tasks t`;

const withUrl = (a) => ({ ...a, file_url: `/api/files/${a.id}?t=${fileToken(a.id)}` });

async function fetchTasks(id) {
  const { rows } = await pool.query(`${SELECT} ${id ? 'where t.id=$1' : ''}`, id ? [id] : []);
  return rows.map((t) => ({
    ...t,
    attachments: t.attachments.map(withUrl),
    chat: t.chat.map((m) => ({ ...m, attachments: m.attachments.map(withUrl) })),
  }));
}

const partnerOf = (meId) => ALLOWED.find((i) => i !== meId);

function resolveAssignee(v, meId) {
  if (v === 'me') return { id: meId };
  if (v === 'partner') return { id: partnerOf(meId) };
  if (v === 'both') return { id: null };
  return null;
}

const includesPartner = (assigneeId, meId) => assigneeId === null || assigneeId === partnerOf(meId);

function parseDue(v) {
  if (v === undefined) return undefined;
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d) ? undefined : d;
}

/** Деньги: число ≥ 0 (до 1 млрд), 2 знака. undefined = поле не передано, null = неверное значение. */
function parseMoney(v) {
  if (v === undefined) return undefined;
  if (v === '' || v === null) return 0;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && n <= 1e9 ? Math.round(n * 100) / 100 : null;
}

/** Координата: undefined = не передано, '' = сброс (null), иначе число в пределах ±max; NaN = ошибка. */
function parseCoord(v, max) {
  if (v === undefined) return undefined;
  if (v === '' || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) && Math.abs(n) <= max ? n : NaN;
}

async function saveFiles(client, taskId, files = [], commentId = null) {
  for (const f of files) {
    await client.query(
      'insert into attachments (task_id, file_name, file_type, size, data, comment_id) values ($1,$2,$3,$4,$5,$6)',
      [taskId, fixName(f.originalname), f.mimetype || 'application/octet-stream', f.size, f.buffer, commentId]
    );
  }
}

async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const r = await fn(client);
    await client.query('commit');
    return r;
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** Уведомление внутри приложения (колокольчик). Telegram-push отправляется отдельно через bot.js. */
async function record(userId, kind, taskId, text) {
  try {
    await pool.query('insert into notifications (user_id, kind, task_id, text) values ($1,$2,$3,$4)', [
      userId,
      kind,
      taskId,
      text.slice(0, 400),
    ]);
  } catch (e) {
    console.error('notifications:', e.message);
  }
}

// ---------- настройки ----------
const REMIND_CHOICES = [5, 10, 15, 30, 60, 120, 1440];
const SETTING_FLAGS = ['n_assigned', 'n_taken', 'n_done', 'n_comment', 'n_chat', 'n_remind'];
const THEMES = ['dark', 'light'];
const ACCENTS = ['orange', 'red', 'yellow', 'green', 'blue', 'purple', 'mono'];

async function getSettings(userId) {
  const { rows } = await pool.query(
    'select remind_minutes, n_assigned, n_taken, n_done, n_comment, n_chat, n_remind, theme, accent from users where id=$1',
    [userId]
  );
  return rows[0];
}

api.get(
  '/me',
  wrap(async (req, res) => {
    const { rows } = await pool.query('select id, first_name, username, photo_url from users where id = any($1)', [
      ALLOWED,
    ]);
    res.json({ me: req.user, users: rows, settings: await getSettings(req.user.id) });
  })
);

api.put(
  '/settings',
  wrap(async (req, res) => {
    const cur = await getSettings(req.user.id);
    const next = { ...cur };
    for (const f of SETTING_FLAGS) if (typeof req.body[f] === 'boolean') next[f] = req.body[f];
    if (REMIND_CHOICES.includes(Number(req.body.remind_minutes))) next.remind_minutes = Number(req.body.remind_minutes);
    if (THEMES.includes(req.body.theme)) next.theme = req.body.theme;
    if (ACCENTS.includes(req.body.accent)) next.accent = req.body.accent;
    await pool.query(
      `update users set remind_minutes=$2, n_assigned=$3, n_taken=$4, n_done=$5, n_comment=$6, n_remind=$7, theme=$8, n_chat=$9, accent=$10
       where id=$1`,
      [req.user.id, next.remind_minutes, next.n_assigned, next.n_taken, next.n_done, next.n_comment, next.n_remind, next.theme, next.n_chat, next.accent]
    );
    // Если сменили порог напоминания, пусть напоминания для будущих задач сработают заново
    if (next.remind_minutes !== cur.remind_minutes)
      await pool.query(
        `delete from reminders_sent where user_id=$1 and task_id in (select id from tasks where due_at > now())`,
        [req.user.id]
      );
    res.json(next);
  })
);

// ---------- адреса (OpenStreetMap Nominatim через сервер) ----------
api.get(
  '/geocode',
  wrap(async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (q.length < 3 || q.length > 200) return res.json([]);
    try {
      res.json(await geocode(q));
    } catch (e) {
      res.status(e.status === 429 ? 429 : 502).json({ error: 'Сервис адресов временно недоступен' });
    }
  })
);

api.get(
  '/reverse',
  wrap(async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
      return res.status(400).json({ error: 'Неверные координаты' });
    try {
      res.json(await reverseGeocode(lat, lng));
    } catch (e) {
      res.status(e.status === 429 ? 429 : 502).json({ error: 'Сервис адресов временно недоступен' });
    }
  })
);

// ---------- проверка связи с ботом (уведомления в чат Telegram) ----------
api.get(
  '/notify-status',
  wrap(async (req, res) => {
    const r = await canReach(req.user.id);
    res.json({ ...r, bot: await botUsername() });
  })
);

api.post(
  '/notify-test',
  wrap(async (req, res) => {
    const r = await deliver(req.user.id, '🔔 Проверка: уведомления работают. Сообщения о задачах будут приходить сюда.');
    res.json({ ...r, bot: await botUsername() });
  })
);

// ---------- уведомления внутри приложения ----------
api.get(
  '/notifications',
  wrap(async (req, res) => {
    const { rows } = await pool.query(
      'select id, kind, task_id, text, read, created_at from notifications where user_id=$1 order by id desc limit 50',
      [req.user.id]
    );
    const { rows: c } = await pool.query('select count(*)::int as n from notifications where user_id=$1 and not read', [
      req.user.id,
    ]);
    res.json({ items: rows, unread: c[0].n });
  })
);

api.post(
  '/notifications/read',
  wrap(async (req, res) => {
    await pool.query('update notifications set read=true where user_id=$1 and not read', [req.user.id]);
    res.json({ ok: true });
  })
);

// ---------- задачи ----------
api.get(
  '/tasks',
  wrap(async (_req, res) => res.json(await fetchTasks()))
);

/** Общая валидация полей, которые есть и при создании, и при правке. Возвращает { error } или { fields }. */
function readCommon(b, before) {
  const out = {};
  const price = parseMoney(b.price);
  if (price === null) return { error: 'Неверная стоимость' };
  const cost = parseMoney(b.cost);
  if (cost === null) return { error: 'Неверная себестоимость' };
  out.price = price ?? before?.price ?? 0;
  out.cost = cost ?? before?.cost ?? 0;

  out.address = b.address !== undefined ? String(b.address).trim().slice(0, 300) : before?.address ?? '';
  out.customer = b.customer !== undefined ? String(b.customer).trim().slice(0, 200) : before?.customer ?? '';

  const lat = parseCoord(b.lat, 90);
  const lng = parseCoord(b.lng, 180);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return { error: 'Неверные координаты' };
  let la = lat === undefined ? before?.lat ?? null : lat;
  let ln = lng === undefined ? before?.lng ?? null : lng;
  if (la === null || ln === null) la = ln = null; // координаты только парой
  out.lat = la;
  out.lng = ln;
  return { fields: out };
}

api.post(
  '/tasks',
  upload.array('files', 10),
  wrap(async (req, res) => {
    const b = req.body;
    const title = (b.title || '').trim();
    if (!title) return res.status(400).json({ error: 'Введите заголовок' });
    const assignee = resolveAssignee(b.assignee || 'me', req.user.id);
    if (!assignee) return res.status(400).json({ error: 'Неверный исполнитель' });
    const due = parseDue(b.due_at);
    const common = readCommon(b, null);
    if (common.error) return res.status(400).json({ error: common.error });
    const f = common.fields;

    const id = await tx(async (c) => {
      const { rows } = await c.query(
        `insert into tasks (title, description, due_at, author_id, assignee_id, priority, price, cost, address, lat, lng, customer)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`,
        [
          title,
          b.description || '',
          due ?? null,
          req.user.id,
          assignee.id,
          validPriority(b.priority) ?? 'normal',
          f.price,
          f.cost,
          f.address,
          f.lat,
          f.lng,
          f.customer,
        ]
      );
      await saveFiles(c, rows[0].id, req.files);
      return rows[0].id;
    });

    const [task] = await fetchTasks(id);
    res.json(task);
    const partner = partnerOf(req.user.id);
    record(partner, 'assigned', task.id, `${req.user.first_name} создал(а) задачу «${task.title}»`);
    // Партнёр получает сообщение о каждой новой задаче (так же, как запись в «Уведомлениях» в приложении)
    notifyAssigned(partner, req.user.first_name, task, includesPartner(task.assignee_id, req.user.id));
  })
);

api.patch(
  '/tasks/:id',
  upload.array('files', 10),
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const [before] = await fetchTasks(id);
    if (!before) return res.status(404).json({ error: 'Задача не найдена' });

    const b = req.body;
    const title = b.title !== undefined ? b.title.trim() : before.title;
    if (!title) return res.status(400).json({ error: 'Введите заголовок' });
    const assignee = b.assignee ? resolveAssignee(b.assignee, req.user.id) : { id: before.assignee_id };
    if (!assignee) return res.status(400).json({ error: 'Неверный исполнитель' });
    const due = parseDue(b.due_at);
    const dueChanged =
      due !== undefined && String(due?.toISOString() ?? null) !== String(before.due_at?.toISOString?.() ?? null);
    const common = readCommon(b, before);
    if (common.error) return res.status(400).json({ error: common.error });
    const f = common.fields;
    let removeIds = [];
    try {
      removeIds = JSON.parse(b.removeIds || '[]').map(Number);
    } catch {}

    await tx(async (c) => {
      await c.query(
        `update tasks set title=$2, description=$3, due_at=$4, assignee_id=$5, priority=$6,
           price=$7, cost=$8, address=$9, lat=$10, lng=$11, customer=$12 where id=$1`,
        [
          id,
          title,
          b.description ?? before.description,
          due === undefined ? before.due_at : due,
          assignee.id,
          validPriority(b.priority) ?? before.priority,
          f.price,
          f.cost,
          f.address,
          f.lat,
          f.lng,
          f.customer,
        ]
      );
      if (dueChanged) await c.query('delete from reminders_sent where task_id=$1', [id]);
      if (removeIds.length) await c.query('delete from attachments where task_id=$1 and id = any($2)', [id, removeIds]);
      await saveFiles(c, id, req.files);
    });

    const [task] = await fetchTasks(id);
    res.json(task);
    const had = includesPartner(before.assignee_id, req.user.id);
    if (!had && includesPartner(task.assignee_id, req.user.id))
      notifyAssigned(partnerOf(req.user.id), req.user.first_name, task);
  })
);

// Догрузить фото и файлы к задаче (например, пока она в работе)
api.post(
  '/tasks/:id/files',
  upload.array('files', 10),
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const [exists] = await fetchTasks(id);
    if (!exists) return res.status(404).json({ error: 'Задача не найдена' });
    if (!req.files?.length) return res.status(400).json({ error: 'Файл не выбран' });
    await tx((c) => saveFiles(c, id, req.files));
    res.json((await fetchTasks(id))[0]);
  })
);

api.post(
  '/tasks/:id/status',
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const status = req.body.status;
    if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Неверный статус' });
    const [before] = await fetchTasks(id);
    if (!before) return res.status(404).json({ error: 'Задача не найдена' });

    // При завершении можно уточнить стоимость и себестоимость (окно «Задача выполнена»)
    const price = parseMoney(req.body.price);
    const cost = parseMoney(req.body.cost);
    if (price === null) return res.status(400).json({ error: 'Неверная стоимость' });
    if (cost === null) return res.status(400).json({ error: 'Неверная себестоимость' });

    // Прибыль фиксируется при завершении: переданная сумма или «стоимость − себестоимость»
    let profit = null;
    if (status === 'done') {
      const given = req.body.profit === undefined || req.body.profit === '' ? NaN : Number(req.body.profit);
      const fallback = (price ?? before.price) - (cost ?? before.cost);
      profit = Number.isFinite(given) && Math.abs(given) <= 1e9 ? Math.round(given * 100) / 100 : fallback;
    }

    await pool.query(
      `update tasks set status=$2, profit=$3,
         completed_at = case when $2='done' then now() else null end,
         taken_by = case when $2='in_progress' then $4::bigint else taken_by end,
         price = coalesce($5::numeric, price), cost = coalesce($6::numeric, cost)
       where id=$1`,
      [id, status, profit, req.user.id, price ?? null, cost ?? null]
    );
    if (before.status === 'done' && status !== 'done') await pool.query('delete from reminders_sent where task_id=$1', [id]);

    const [task] = await fetchTasks(id);
    res.json(task);

    const partner = partnerOf(req.user.id);
    const name = req.user.first_name;
    if (status === 'in_progress' && before.status === 'new') {
      record(partner, 'taken', id, `${name} взял(а) в работу «${task.title}»`);
      notifyTaken(partner, name, task);
    } else if (status === 'done' && before.status !== 'done') {
      record(partner, 'done', id, `${name} выполнил(а) «${task.title}»`);
      notifyDone(partner, name, task);
    }
  })
);

api.post(
  '/tasks/:id/comments',
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const text = (req.body.text || '').trim().slice(0, 2000);
    if (!text) return res.status(400).json({ error: 'Введите комментарий' });
    const [exists] = await fetchTasks(id);
    if (!exists) return res.status(404).json({ error: 'Задача не найдена' });
    await pool.query("insert into comments (task_id, author_id, text, kind) values ($1,$2,$3,'comment')", [id, req.user.id, text]);
    const [task] = await fetchTasks(id);
    res.json(task);
    const partner = partnerOf(req.user.id);
    record(partner, 'comment', id, `${req.user.first_name} · «${task.title}»: ${text}`);
    notifyComment(partner, req.user.first_name, task, text);
  })
);

// Сообщение в чате задачи (раздел «Чат»): отдельная переписка, не связанная с комментариями в карточке задачи
api.post(
  '/tasks/:id/chat',
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const text = (req.body.text || '').trim().slice(0, 2000);
    if (!text) return res.status(400).json({ error: 'Введите сообщение' });
    const [exists] = await fetchTasks(id);
    if (!exists) return res.status(404).json({ error: 'Задача не найдена' });
    await pool.query("insert into comments (task_id, author_id, text, kind) values ($1,$2,$3,'chat')", [id, req.user.id, text]);
    const [task] = await fetchTasks(id);
    res.json(task);
    const partner = partnerOf(req.user.id);
    record(partner, 'chat', id, `${req.user.first_name} · чат «${task.title}»: ${text}`);
    notifyChat(partner, req.user.first_name, task, text);
  })
);

// Фото и файлы из чата: одно сообщение чата с вложениями (в «Файлы» задачи они не попадают)
api.post(
  '/tasks/:id/chat-files',
  upload.array('files', 10),
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const [exists] = await fetchTasks(id);
    if (!exists) return res.status(404).json({ error: 'Задача не найдена' });
    if (!req.files?.length) return res.status(400).json({ error: 'Файл не выбран' });
    await tx(async (c) => {
      const { rows } = await c.query(
        "insert into comments (task_id, author_id, text, kind) values ($1,$2,'','chat') returning id",
        [id, req.user.id]
      );
      await saveFiles(c, id, req.files, rows[0].id);
    });
    const [task] = await fetchTasks(id);
    res.json(task);
    const partner = partnerOf(req.user.id);
    const names = req.files.map((f) => fixName(f.originalname));
    const summary = names.length > 1 ? `📎 файлов: ${names.length}` : `📎 ${names[0]}`;
    record(partner, 'chat', id, `${req.user.first_name} · чат «${task.title}»: ${summary}`);
    notifyChat(partner, req.user.first_name, task, summary);
  })
);

api.delete(
  '/tasks/:id/comments/:cid',
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    await pool.query("delete from comments where id=$1 and task_id=$2 and author_id=$3 and kind='comment'", [
      Number(req.params.cid),
      id,
      req.user.id,
    ]);
    res.json((await fetchTasks(id))[0]);
  })
);

// ---------- закреплённые задачи (у каждого свои) ----------
const myPins = async (userId) => {
  const { rows } = await pool.query('select task_id from task_pins where user_id=$1 order by created_at desc', [userId]);
  return rows.map((x) => x.task_id);
};

api.get(
  '/pins',
  wrap(async (req, res) => res.json(await myPins(req.user.id)))
);

api.post(
  '/tasks/:id/pin',
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const [exists] = await fetchTasks(id);
    if (!exists) return res.status(404).json({ error: 'Задача не найдена' });
    if (req.body.pinned === false) await pool.query('delete from task_pins where user_id=$1 and task_id=$2', [req.user.id, id]);
    else await pool.query('insert into task_pins (user_id, task_id) values ($1,$2) on conflict do nothing', [req.user.id, id]);
    res.json(await myPins(req.user.id));
  })
);

// ---------- общий резерв: ручное пополнение и расход ----------
const RESERVE_RATE = 0.2;

/** Остаток резерва: 20% прибыли выполненных задач + пополнения − расходы */
async function reserveBalance() {
  const { rows } = await pool.query(
    `select
       coalesce((select sum(round(profit * $1, 2)) from tasks where status='done' and profit > 0), 0)
       + coalesce((select sum(amount) from reserve_entries where kind='add'), 0)
       - coalesce((select sum(amount) from reserve_entries where kind='withdraw'), 0) as balance`,
    [RESERVE_RATE]
  );
  return Number(rows[0].balance);
}

api.get(
  '/reserve',
  wrap(async (_req, res) => {
    const { rows } = await pool.query('select id, kind, amount, note, author_id, created_at from reserve_entries order by id');
    res.json(rows);
  })
);

api.post(
  '/reserve',
  wrap(async (req, res) => {
    const kind = req.body.kind;
    if (kind !== 'add' && kind !== 'withdraw') return res.status(400).json({ error: 'Неверная операция' });
    const amount = parseMoney(req.body.amount);
    if (!amount) return res.status(400).json({ error: 'Введите сумму больше нуля' });
    const note = String(req.body.note || '').trim().slice(0, 300);
    if (!note) return res.status(400).json({ error: kind === 'withdraw' ? 'Укажите, на что потрачены средства' : 'Укажите назначение' });
    if (kind === 'withdraw' && amount > (await reserveBalance()) + 0.001)
      return res.status(400).json({ error: 'В резерве недостаточно средств' });
    await pool.query('insert into reserve_entries (kind, amount, note, author_id) values ($1,$2,$3,$4)', [
      kind,
      amount,
      note,
      req.user.id,
    ]);
    const { rows } = await pool.query('select id, kind, amount, note, author_id, created_at from reserve_entries order by id');
    res.json(rows);
    const verb = kind === 'add' ? 'пополнил(а)' : 'потратил(а) из';
    record(partnerOf(req.user.id), 'chat', null, `${req.user.first_name} ${verb} общий резерв: ${amount} ₽ · ${note}`);
  })
);

api.delete(
  '/reserve/:id',
  wrap(async (req, res) => {
    await pool.query('delete from reserve_entries where id=$1 and author_id=$2', [Number(req.params.id), req.user.id]);
    const { rows } = await pool.query('select id, kind, amount, note, author_id, created_at from reserve_entries order by id');
    res.json(rows);
  })
);

api.delete(
  '/tasks/:id',
  wrap(async (req, res) => {
    await pool.query('delete from tasks where id=$1', [Number(req.params.id)]);
    res.json({ ok: true });
  })
);
