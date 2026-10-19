import { useEffect, useState } from 'react';
import WebApp from '@twa-dev/sdk';
import { api, type TgStatus } from '../api';
import type { Settings, Theme } from '../types';
import { ACCENTS, applyAccent, applyTheme } from '../theme';
import { haptic, inTelegram } from '../utils';
import { Icon } from './Icon';

const REASON_TEXT: Record<NonNullable<TgStatus['reason']>, string> = {
  not_started: 'Бот пока не может писать вам. Откройте бота и нажмите «Запустить».',
  blocked: 'Вы заблокировали бота. Разблокируйте его в Telegram, чтобы получать сообщения.',
  error: 'Не удалось связаться с ботом.',
};

function openBot(name: string) {
  const url = `https://t.me/${name}`;
  if (inTelegram()) WebApp.openTelegramLink(url);
  else window.open(url, '_blank');
}

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
  onError: (e: unknown) => void;
}

const REMIND_OPTIONS: [number, string][] = [
  [5, 'за 5 минут'],
  [10, 'за 10 минут'],
  [15, 'за 15 минут'],
  [30, 'за 30 минут'],
  [60, 'за 1 час'],
  [120, 'за 2 часа'],
  [1440, 'за сутки'],
];

type Flag = 'n_assigned' | 'n_taken' | 'n_comment' | 'n_chat' | 'n_done' | 'n_remind';
const FLAGS: { key: Flag; title: string }[] = [
  { key: 'n_assigned', title: 'Новая задача' },
  { key: 'n_taken', title: 'Задача взята в работу' },
  { key: 'n_done', title: 'Задача выполнена' },
  { key: 'n_comment', title: 'Комментарий к задаче' },
  { key: 'n_chat', title: 'Сообщение в чате' },
  { key: 'n_remind', title: 'Напоминание о сроке' },
];

export function SettingsScreen({ settings, onChange, onError }: Props) {
  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState(false);
  const any = FLAGS.some((f) => settings[f.key]);

  // Связь с ботом: дойдут ли сообщения в чат Telegram
  const [tg, setTg] = useState<TgStatus | null>(null);
  const [tgBusy, setTgBusy] = useState(false);
  const [tgNote, setTgNote] = useState('');
  useEffect(() => {
    api.notifyStatus().then(setTg).catch(() => setTg(null));
  }, []);

  async function sendTest() {
    setTgBusy(true);
    setTgNote('');
    haptic();
    try {
      const r = await api.notifyTest();
      setTg(r);
      setTgNote(r.ok ? 'Проверочное сообщение отправлено. Загляните в чат с ботом.' : REASON_TEXT[r.reason ?? 'error']);
    } catch (e) {
      onError(e);
    } finally {
      setTgBusy(false);
    }
  }

  async function save(patch: Partial<Settings>) {
    const prev = settings;
    onChange({ ...settings, ...patch }); // оптимистично
    if (patch.theme) applyTheme(patch.theme);
    if (patch.accent) applyAccent(patch.accent);
    setBusy(true);
    haptic();
    try {
      onChange(await api.saveSettings(patch));
    } catch (e) {
      onChange(prev);
      if (patch.theme) applyTheme(prev.theme);
      if (patch.accent) applyAccent(prev.accent);
      onError(e);
    } finally {
      setBusy(false);
    }
  }

  const setAll = (on: boolean) => save({ n_assigned: on, n_taken: on, n_done: on, n_comment: on, n_chat: on, n_remind: on });

  return (
    <div className="settings">
      <section className="dcard">
        <div className="dlabel">Уведомления</div>
        <label className="srow">
          <span className="srow-title">Присылать уведомления</span>
          <input type="checkbox" className="switch" checked={any} disabled={busy} onChange={(e) => setAll(e.target.checked)} />
        </label>
        <button className="srow link" onClick={() => setDetails(!details)} aria-expanded={details}>
          <span className="srow-title">Настроить подробнее</span>
          <span className={'chev' + (details ? ' open' : '')}>
            <Icon name="chevron" size={20} />
          </span>
        </button>
        {details && (
          <>
            {FLAGS.map((f) => (
              <label key={f.key} className="srow sub">
                <span className="srow-title">{f.title}</span>
                <input
                  type="checkbox"
                  className="switch"
                  checked={settings[f.key]}
                  disabled={busy}
                  onChange={(e) => save({ [f.key]: e.target.checked })}
                />
              </label>
            ))}
            <label className={'srow sub' + (settings.n_remind ? '' : ' disabled')}>
              <span className="srow-title">Напоминать</span>
              <select
                className="select"
                value={settings.remind_minutes}
                disabled={busy || !settings.n_remind}
                onChange={(e) => save({ remind_minutes: Number(e.target.value) })}
              >
                {REMIND_OPTIONS.map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </section>

      <section className="dcard tg-card">
        <div className="dlabel">Уведомления в Telegram</div>
        {tg === null ? (
          <div className="tg-status muted">Проверяем связь с ботом…</div>
        ) : tg.ok ? (
          <div className="tg-status ok">✅ Бот может писать вам. Сообщения приходят в чат с ботом.</div>
        ) : (
          <div className="tg-status bad">⚠️ {REASON_TEXT[tg.reason ?? 'error']}</div>
        )}
        {tgNote && (
          <div className="muted tg-note" role="status">
            {tgNote}
          </div>
        )}
        <div className="tg-actions">
          {tg && !tg.ok && tg.bot && (
            <button className="primary small" onClick={() => openBot(tg.bot!)}>
              Открыть бота
            </button>
          )}
          <button className="secondary small" onClick={sendTest} disabled={tgBusy}>
            {tgBusy ? 'Отправляем…' : 'Отправить тест'}
          </button>
        </div>
      </section>

      <section className="dcard">
        <div className="dlabel">Тема</div>
        <div className="seg-pill wide" role="radiogroup" aria-label="Тема">
          {([['light', 'Светлая'], ['dark', 'Тёмная']] as [Theme, string][]).map(([k, label]) => (
            <button
              key={k}
              role="radio"
              aria-checked={settings.theme === k}
              className={settings.theme === k ? 'active' : ''}
              onClick={() => save({ theme: k })}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="dlabel accent-label">Цвет интерфейса</div>
        <div className="swatches" role="radiogroup" aria-label="Цвет интерфейса">
          {ACCENTS.map((a) => (
            <button
              key={a.key}
              role="radio"
              aria-checked={settings.accent === a.key}
              aria-label={a.label}
              title={a.label}
              className={'swatch' + (settings.accent === a.key ? ' active' : '')}
              style={{ background: a.swatch, color: '#111111' }}
              onClick={() => save({ accent: a.key })}
            >
              {settings.accent === a.key && <Icon name="check" size={18} strokeWidth={3.4} />}
            </button>
          ))}
        </div>
      </section>

      <p className="muted lead">Уведомления приходят от бота в Telegram. Эти настройки действуют только для вас.</p>
    </div>
  );
}
