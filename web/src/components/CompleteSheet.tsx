import { useState } from 'react';
import type { Task, User } from '../types';
import { assigneesOf, cleanMoney, cleanSignedMoney, fmtDue, toNum } from '../utils';
import { AvatarStack } from './Avatar';
import { Icon } from './Icon';
import { Modal } from './Modal';

export interface CompleteValues {
  price: number;
  cost: number;
  profit: number;
}

interface Props {
  task: Task;
  users: User[];
  onConfirm: (v: CompleteValues) => Promise<void>;
  onClose: () => void;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Окно «Задача выполнена»: сводка по задаче и итоговые суммы (стоимость, себестоимость, прибыль) */
export function CompleteSheet({ task, users, onConfirm, onClose }: Props) {
  const [price, setPrice] = useState(task.price ? String(task.price) : '');
  const [cost, setCost] = useState(task.cost ? String(task.cost) : '');
  // Прибыль по умолчанию = стоимость − себестоимость; пока её не правили вручную, она пересчитывается
  const [profit, setProfit] = useState(String(round2(task.price - task.cost)));
  const [profitTouched, setProfitTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  const recalc = (p: string, c: string) => {
    if (!profitTouched) setProfit(String(round2(toNum(p) - toNum(c))));
  };

  async function confirm() {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm({ price: toNum(price), cost: toNum(cost), profit: toNum(profit) });
    } finally {
      setBusy(false);
    }
  }

  const executors = assigneesOf(task, users);

  return (
    <Modal onClose={onClose} label="Задача выполнена">
      <div className="sheet-head">
        <span className="sheet-check">
          <Icon name="check" size={20} strokeWidth={3} />
        </span>
        <div className="sheet-head-text">
          <div className="sheet-title">Задача выполнена</div>
          <div className="muted ellipsis">№{task.id} · {task.title}</div>
        </div>
      </div>

      <div className="dcard rows modal-info">
        {task.customer && (
          <div className="drow">
            <Icon name="user" size={18} />
            <span className="drow-label">Заказчик</span>
            <span className="drow-value">{task.customer}</span>
          </div>
        )}
        <div className="drow">
          <Icon name="clock" size={18} />
          <span className="drow-label">Срок</span>
          <span className="drow-value">{fmtDue(task.due_at)}</span>
        </div>
        <div className="drow">
          <Icon name="users" size={18} />
          <span className="drow-label">{executors.length > 1 ? 'Исполнители' : 'Исполнитель'}</span>
          <span className="drow-value">
            <AvatarStack users={executors} size={30} />
          </span>
        </div>
      </div>

      <div className="two-cols">
        <div>
          <label className="field-label" htmlFor="c-price">Стоимость, ₽</label>
          <input
            id="c-price"
            className="field"
            inputMode="decimal"
            value={price}
            placeholder="0"
            onChange={(e) => {
              const v = cleanMoney(e.target.value);
              setPrice(v);
              recalc(v, cost);
            }}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="c-cost">Себестоимость, ₽</label>
          <input
            id="c-cost"
            className="field"
            inputMode="decimal"
            value={cost}
            placeholder="0"
            onChange={(e) => {
              const v = cleanMoney(e.target.value);
              setCost(v);
              recalc(price, v);
            }}
          />
        </div>
      </div>

      <label className="field-label" htmlFor="profit-input">Сумма прибыли, ₽</label>
      <input
        id="profit-input"
        className="field accent"
        inputMode="decimal"
        value={profit}
        onChange={(e) => {
          setProfit(cleanSignedMoney(e.target.value));
          setProfitTouched(true);
        }}
        onFocus={(e) => e.target.select()}
        placeholder="0"
      />
      <div className="muted hint">Сумма добавится в прибыль на главной. Её можно изменить.</div>

      <button className="primary" onClick={confirm} disabled={busy}>
        {busy ? 'Сохранение…' : 'Подтвердить'}
      </button>
      <button className="secondary cancel" onClick={onClose} disabled={busy}>
        Отмена
      </button>
    </Modal>
  );
}
