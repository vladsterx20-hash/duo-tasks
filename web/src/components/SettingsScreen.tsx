import { useState } from 'react';
import { api } from '../api';
import type { Settings } from '../types';
import { haptic } from '../utils';

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

const TOGGLES: { key: 'n_assigned' | 'n_comment' | 'n_done' | 'n_remind'; title: string; hint: string }[] = [
  { key: 'n_assigned', title: 'Новая задача', hint: 'Когда партнёр назначает задачу вам' },
  { key: 'n_comment', title: 'Комментарии', hint: 'Когда партнёр пишет комментарий' },
  { key: 'n_done', title: 'Задача выполнена', hint: 'Когда партнёр отмечает задачу выполненной' },
  { key: 'n_remind', title: 'Напоминания о сроке', hint: 'Перед наступлением срока задачи' },
];

export function SettingsScreen({ settings, onChange, onError }: Props) {
  const [busy, setBusy] = useState(false);

  async function save(patch: Partial<Settings>) {
    const prev = settings;
    onChange({ ...settings, ...patch }); // оптимистично
    setBusy(true);
    haptic();
    try {
      onChange(await api.saveSettings(patch));
    } catch (e) {
      onChange(prev);
      onError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <h1>Уведомления</h1>
      <p className="muted lead">Эти настройки действуют только для вас. Сообщения приходят от бота в Telegram.</p>

      <div className="group">
        {TOGGLES.map((t) => (
          <label key={t.key} className="row-toggle">
            <span className="row-text">
              <span className="row-title">{t.title}</span>
              <span className="muted">{t.hint}</span>
            </span>
            <input
              type="checkbox"
              className="switch"
              checked={settings[t.key]}
              disabled={busy}
              onChange={(e) => save({ [t.key]: e.target.checked })}
            />
          </label>
        ))}
      </div>

      <h2>Когда напоминать</h2>
      <div className="group">
        <label className={'row-toggle' + (settings.n_remind ? '' : ' disabled')}>
          <span className="row-text">
            <span className="row-title">Напоминание перед сроком</span>
          </span>
          <select
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
      </div>
    </div>
  );
}
