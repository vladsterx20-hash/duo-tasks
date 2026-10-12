import express from 'express';
import multer from 'multer';
import { pool } from './db.js';
import { auth, fileToken } from './auth.js';
import { ALLOWED, MAX_FILE } from './config.js';
import { notifyAssigned, notifyDone, notifyComment } from './bot.js';

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
const validPriority = (v) => (PRIORITIES.includes(v) ? v : undefined);

const SELECT = `
  select t.id, t.title, t.description, t.due_at, t.status, t.priority, t.author_id, t.assignee_id,
         t.created_at, t.completed_at,
         coalesce((select json_agg(json_build_object('id',a.id,'file_name',a.file_name,'file_type',a.file_type,'size',a.size)
                   order by a.id) from attachments a where a.task_id = t.id), '[]'::json) as attachments,
         coalesce((select json_agg(json_build_object('id',c.id,'author_id',c.author_id,'text',c.text,'created_at',c.created_at)
                   order by c.id) from comments c where c.task_id = t.id), '[]'::json) as comments
  from tasks t`;

async function fetchTasks(id) {
  const { rows } = await pool.query(`${SELECT} ${id ? 'where t.id=$1' : ''}`, id ? [id] : []);
  return rows.map((t) => ({
    ...t,
    attachments: t.attachments.map((a) => ({ ...a, file_url: `/api/files/${a.id}?t=${fileToken(a.id)}` })),
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

async function saveFiles(client, taskId, files = []) {
  for (const f of files) {
    await client.query(
      'insert into attachments (task_id, file_name, file_type, size, data) values ($1,$2,$3,$4,$5)',
      [taskId, fixName(f.originalname), f.mimetype || 'application/octet-stream', f.size, f.buffer]
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

// ---------- API ----------
api.get(
  '/me',
  wrap(async (req, res) => {
    const { rows } = await pool.query('select id, first_name, username, photo_url from users where id = any($1)', [
      ALLOWED,
    ]);
    res.json({ me: req.user, users: rows });
  })
);

api.get(
  '/tasks',
  wrap(async (_req, res) => res.json(await fetchTasks()))
);

api.post(
  '/tasks',
  upload.array('files', 10),
  wrap(async (req, res) => {
    const title = (req.body.title || '').trim();
    if (!title) return res.status(400).json({ error: 'Введите заголовок' });
    const assignee = resolveAssignee(req.body.assignee || 'me', req.user.id);
    if (!assignee) return res.status(400).json({ error: 'Неверный исполнитель' });
    const due = parseDue(req.body.due_at);

    const id = await tx(async (c) => {
      const { rows } = await c.query(
        `insert into tasks (title, description, due_at, author_id, assignee_id, priority)
         values ($1,$2,$3,$4,$5,$6) returning id`,
        [title, req.body.description || '', due ?? null, req.user.id, assignee.id, validPriority(req.body.priority) ?? 'normal']
      );
      await saveFiles(c, rows[0].id, req.files);
      return rows[0].id;
    });

    const [task] = await fetchTasks(id);
    res.json(task);
    if (includesPartner(task.assignee_id, req.user.id)) notifyAssigned(partnerOf(req.user.id), req.user.first_name, task);
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
    const dueChanged = due !== undefined && String(due?.toISOString() ?? null) !== String(before.due_at?.toISOString?.() ?? null);
    let removeIds = [];
    try {
      removeIds = JSON.parse(b.removeIds || '[]').map(Number);
    } catch {}

    await tx(async (c) => {
      await c.query(
        `update tasks set title=$2, description=$3, due_at=$4, assignee_id=$5, priority=$7,
           reminded = case when $6 then false else reminded end where id=$1`,
        [
          id,
          title,
          b.description ?? before.description,
          due === undefined ? before.due_at : due,
          assignee.id,
          dueChanged,
          validPriority(b.priority) ?? before.priority,
        ]
      );
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

api.post(
  '/tasks/:id/status',
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const done = req.body.status === 'done';
    const [before] = await fetchTasks(id);
    if (!before) return res.status(404).json({ error: 'Задача не найдена' });
    await pool.query(
      `update tasks set status=$2, completed_at = case when $2='done' then now() else null end,
         reminded = case when $2='done' then reminded else false end where id=$1`,
      [id, done ? 'done' : 'new']
    );
    const [task] = await fetchTasks(id);
    res.json(task);
    if (done && before.status !== 'done') notifyDone(partnerOf(req.user.id), req.user.first_name, task);
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
    await pool.query('insert into comments (task_id, author_id, text) values ($1,$2,$3)', [id, req.user.id, text]);
    const [task] = await fetchTasks(id);
    res.json(task);
    notifyComment(partnerOf(req.user.id), req.user.first_name, task, text);
  })
);

api.delete(
  '/tasks/:id/comments/:cid',
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    await pool.query('delete from comments where id=$1 and task_id=$2 and author_id=$3', [
      Number(req.params.cid),
      id,
      req.user.id,
    ]);
    res.json((await fetchTasks(id))[0]);
  })
);

api.delete(
  '/tasks/:id',
  wrap(async (req, res) => {
    await pool.query('delete from tasks where id=$1', [Number(req.params.id)]);
    res.json({ ok: true });
  })
);
