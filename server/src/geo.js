import { APP_URL } from './config.js';

// Nominatim (OpenStreetMap): бесплатно, без ключей. Условия сервиса:
// не чаще 1 запроса в секунду, осмысленный User-Agent, кэширование. Поэтому все запросы идут через сервер:
// общая очередь для обоих пользователей и кэш.
const BASE = 'https://nominatim.openstreetmap.org';
const UA = `DuoTasks/1.0 (private two-person task tracker; ${APP_URL || 'no-url'})`;
const MIN_GAP_MS = 1100;
const MAX_QUEUE = 6;
const TTL_MS = 60 * 60 * 1000;

const cache = new Map();
let chain = Promise.resolve();
let last = 0;
let queued = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function schedule(task) {
  if (queued >= MAX_QUEUE) throw Object.assign(new Error('busy'), { status: 429 });
  queued++;
  const run = chain.then(async () => {
    try {
      const wait = Math.max(0, last + MIN_GAP_MS - Date.now());
      if (wait) await sleep(wait);
      last = Date.now();
      return await task();
    } finally {
      queued--;
    }
  });
  chain = run.catch(() => {});
  return run;
}

async function cached(key, fetcher) {
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.value;
  const value = await schedule(fetcher);
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  cache.set(key, { value, exp: Date.now() + TTL_MS });
  return value;
}

async function getJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ru' } });
  if (!r.ok) throw new Error(`nominatim ${r.status}`);
  return r.json();
}

export const geocode = (q) =>
  cached(`s:${q.toLowerCase()}`, async () => {
    const rows = await getJson(`${BASE}/search?format=jsonv2&limit=5&q=${encodeURIComponent(q)}`);
    return rows.map((r) => ({ label: r.display_name, lat: Number(r.lat), lng: Number(r.lon) }));
  });

export const reverseGeocode = (lat, lng) =>
  cached(`r:${lat.toFixed(5)},${lng.toFixed(5)}`, async () => {
    const r = await getJson(`${BASE}/reverse?format=jsonv2&zoom=18&lat=${lat}&lon=${lng}`);
    return r && r.display_name ? { label: r.display_name } : null;
  });
