import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import './config.js';
import { initDb } from './db.js';
import { api } from './routes.js';
import { startBot } from './bot.js';
import { startReminders } from './reminders.js';

const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use('/api', api);

// Раздаём собранный фронтенд
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Файл больше 20 МБ' });
  if (err.name === 'MulterError') return res.status(400).json({ error: 'Ошибка загрузки файла' });
  console.error(err);
  res.status(500).json({ error: 'Ошибка сервера' });
});

await initDb();
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Сервер: http://localhost:${port}`));
await startBot();
startReminders();
