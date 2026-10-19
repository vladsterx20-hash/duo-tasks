// Локальный демо-сервер: без Telegram-бота и базы данных, данные хранятся в памяти.
// Запуск: node server/dev-stub.mjs  (нужна собранная web/dist: npm run build)
import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

const ME = 906246768;
const PARTNER = 7976859734;
const users = [
  { id: ME, first_name: 'Вы', username: null, photo_url: null },
  { id: PARTNER, first_name: 'Партнёр', username: null, photo_url: null },
];
const settings = {
  remind_minutes: 30, n_assigned: true, n_taken: true, n_done: true, n_comment: true, n_chat: true, n_remind: true,
  theme: 'dark', accent: 'orange',
};

const iso = (daysAgo, hour = 12) => new Date(Date.now() - daysAgo * 864e5 + (hour - 12) * 36e5).toISOString();
let nextId = 1;
const mk = (o) => ({
  id: nextId++, title: '', description: '', due_at: null, status: 'new', priority: 'normal', author_id: ME, assignee_id: ME,
  created_at: iso(5), completed_at: null, price: 0, cost: 0, profit: null, address: '', lat: null, lng: null,
  customer: '', taken_by: null, attachments: [], comments: [], chat: [], ...o,
});
const tasks = [
  mk({ title: 'Установка кондиционера', customer: 'ООО «Север»', status: 'new', due_at: iso(-1), price: 45000, cost: 28000, address: 'Москва, Тверская 1', lat: 55.7575, lng: 37.6156 }),
  mk({ title: 'Ремонт проводки', customer: 'Иванов', status: 'in_progress', taken_by: ME, due_at: iso(-2), price: 12000, cost: 4000, address: 'Москва, Арбат 10', lat: 55.752, lng: 37.592 }),
  mk({ title: 'Монтаж камер', customer: 'ИП Петров', status: 'done', completed_at: iso(2), price: 30000, cost: 18000, profit: 12000 }),
  mk({ title: 'Настройка сети офиса', customer: 'ООО «Альфа»', status: 'done', completed_at: iso(10), price: 20000, cost: 5000, profit: 15000 }),
  mk({ title: 'Замена розеток', customer: 'Сидорова', status: 'done', completed_at: iso(40), price: 8000, cost: 3000, profit: 5000 }),
];
tasks[1].chat.push({ id: 1, author_id: PARTNER, text: 'Привет! Когда будешь на объекте?', created_at: iso(0, 9), attachments: [] });

const files = new Map();
let nextFile = 1;
let nextComment = 100;
const withUrl = (a) => ({ id: a.id, file_name: a.file_name, file_type: a.file_type, size: a.size, file_url: `/api/files/${a.id}` });
const view = (t) => ({ ...t });
const find = (req) => tasks.find((t) => t.id === Number(req.params.id));
const storeFiles = (list = []) =>
  list.map((f) => {
    const id = nextFile++;
    const name = Buffer.from(f.originalname, 'latin1').toString('utf8');
    files.set(id, { type: f.mimetype, data: f.buffer, name });
    return withUrl({ id, file_name: name, file_type: f.mimetype || 'application/octet-stream', size: f.size });
  });

const api = express.Router();
api.get('/me', (_q, r) => r.json({ me: users[0], users, settings }));
api.put('/settings', (q, r) => {
  for (const k of Object.keys(settings)) if (q.body[k] !== undefined) settings[k] = q.body[k];
  r.json(settings);
});
api.get('/tasks', (_q, r) => r.json(tasks.map(view)));
api.post('/tasks', upload.array('files'), (q, r) => {
  const b = q.body;
  const t = mk({
    title: b.title, description: b.description || '', customer: b.customer || '', address: b.address || '',
    price: Number(b.price) || 0, cost: Number(b.cost) || 0, due_at: b.due_at || null, priority: b.priority || 'normal',
    lat: b.lat ? Number(b.lat) : null, lng: b.lng ? Number(b.lng) : null, created_at: iso(0),
    assignee_id: b.assignee === 'partner' ? PARTNER : b.assignee === 'both' ? null : ME,
    attachments: storeFiles(q.files),
  });
  tasks.unshift(t);
  r.json(view(t));
});
api.patch('/tasks/:id', upload.array('files'), (q, r) => {
  const t = find(q);
  if (!t) return r.status(404).json({ error: 'Задача не найдена' });
  for (const k of ['title', 'description', 'customer', 'address', 'priority', 'due_at']) if (q.body[k] !== undefined) t[k] = q.body[k] || (k === 'due_at' ? null : '');
  if (q.body.price !== undefined) t.price = Number(q.body.price) || 0;
  if (q.body.cost !== undefined) t.cost = Number(q.body.cost) || 0;
  t.attachments.push(...storeFiles(q.files));
  r.json(view(t));
});
api.post('/tasks/:id/status', (q, r) => {
  const t = find(q);
  if (!t) return r.status(404).json({ error: 'Задача не найдена' });
  const { status, price, cost, profit } = q.body;
  if (price !== undefined) t.price = Number(price);
  if (cost !== undefined) t.cost = Number(cost);
  t.status = status;
  t.completed_at = status === 'done' ? new Date().toISOString() : null;
  t.profit = status === 'done' ? (profit !== undefined && profit !== '' ? Number(profit) : t.price - t.cost) : null;
  if (status === 'in_progress') t.taken_by = ME;
  r.json(view(t));
});
api.post('/tasks/:id/files', upload.array('files'), (q, r) => {
  const t = find(q);
  t.attachments.push(...storeFiles(q.files));
  r.json(view(t));
});
api.post('/tasks/:id/chat-files', upload.array('files'), (q, r) => {
  const t = find(q);
  t.chat.push({ id: nextComment++, author_id: ME, text: '', created_at: new Date().toISOString(), attachments: storeFiles(q.files) });
  r.json(view(t));
});
api.post('/tasks/:id/chat', (q, r) => {
  const t = find(q);
  t.chat.push({ id: nextComment++, author_id: ME, text: q.body.text, created_at: new Date().toISOString(), attachments: [] });
  r.json(view(t));
});
api.post('/tasks/:id/comments', (q, r) => {
  const t = find(q);
  t.comments.push({ id: nextComment++, author_id: ME, text: q.body.text, created_at: new Date().toISOString() });
  r.json(view(t));
});
api.delete('/tasks/:id/comments/:cid', (q, r) => {
  const t = find(q);
  t.comments = t.comments.filter((c) => c.id !== Number(q.params.cid));
  r.json(view(t));
});
api.delete('/tasks/:id', (q, r) => {
  const i = tasks.findIndex((t) => t.id === Number(q.params.id));
  if (i >= 0) tasks.splice(i, 1);
  r.json({ ok: true });
});
api.get('/files/:id', (q, r) => {
  const f = files.get(Number(q.params.id));
  if (!f) return r.status(404).end();
  r.setHeader('Content-Type', f.type || 'application/octet-stream');
  r.send(f.data);
});
const reserveEntries = [];
let nextEntry = 1;
const balanceNow = () =>
  tasks.filter((t) => t.status === 'done' && t.profit > 0).reduce((a, t) => a + Math.round(t.profit * 0.2 * 100) / 100, 0) +
  reserveEntries.reduce((a, e) => a + (e.kind === 'add' ? e.amount : -e.amount), 0);
api.get('/reserve', (_q, r) => r.json(reserveEntries));
api.post('/reserve', (q, r) => {
  const { kind, note } = q.body;
  const amount = Number(q.body.amount);
  if (!amount || amount <= 0) return r.status(400).json({ error: 'Введите сумму больше нуля' });
  if (!note) return r.status(400).json({ error: 'Укажите назначение' });
  if (kind === 'withdraw' && amount > balanceNow()) return r.status(400).json({ error: 'В резерве недостаточно средств' });
  reserveEntries.push({ id: nextEntry++, kind, amount, note, author_id: ME, created_at: new Date().toISOString() });
  r.json(reserveEntries);
});
api.delete('/reserve/:id', (q, r) => {
  const i = reserveEntries.findIndex((e) => e.id === Number(q.params.id));
  if (i >= 0) reserveEntries.splice(i, 1);
  r.json(reserveEntries);
});
api.get('/notifications', (_q, r) => r.json({ items: [], unread: 0 }));
api.post('/notifications/read', (_q, r) => r.json({ ok: true }));
api.get('/notify-status', (_q, r) => r.json({ ok: true, bot: 'demo_bot' }));
api.post('/notify-test', (_q, r) => r.json({ ok: true, bot: 'demo_bot' }));
api.get('/geocode', (_q, r) => r.json([]));
api.get('/reverse', (_q, r) => r.json(null));

app.use('/api', api);
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../web/dist');
app.use(express.static(dist));
app.get('*', (_q, r) => r.sendFile(path.join(dist, 'index.html')));

const port = process.env.PORT || 3100;
app.listen(port, () => console.log(`Демо-сервер: http://localhost:${port}`));
