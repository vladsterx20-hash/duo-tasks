import { useState } from 'react';
import type { Task } from '../types';
import { cleanSignedMoney, toNum } from '../utils';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

interface Props {
  task: Task;
  onConfirm: (profit: number) => Promise<void>;
  onClose: () => void;
}

export function CompleteSheet({ task, onConfirm, onClose }: Props) {
  // По умолчанию: стоимость − себестоимость; сумму можно изменить
  const [value, setValue] = useState(String(Math.round((task.price - task.cost) * 100) / 100));
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm(toNum(value));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet onClose={onClose}>
      <div className="sheet-head">
        <span className="sheet-check">
          <Icon name="check" size={20} strokeWidth={3} />
        </span>
        <div className="sheet-head-text">
          <div className="sheet-title">Задача выполнена</div>
          <div className="muted ellipsis">{task.title}</div>
        </div>
      </div>

      <label className="field-label" htmlFor="profit-input">
        Сумма прибыли, ₽
      </label>
      <input
        id="profit-input"
        className="field accent"
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(cleanSignedMoney(e.target.value))}
        onFocus={(e) => e.target.select()}
        placeholder="0"
      />
      <div className="muted hint">Сумма добавится в прибыль на главной</div>

      <button className="primary" onClick={confirm} disabled={busy}>
        {busy ? 'Сохранение…' : 'Подтвердить'}
      </button>
    </Sheet>
  );
}
