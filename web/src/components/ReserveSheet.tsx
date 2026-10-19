import { useState } from 'react';
import { cleanMoney, fmtMoney, toNum } from '../utils';
import { Modal } from './Modal';

interface Props {
  /** текущий остаток резерва — по нему считается «баланс после» */
  balance: number;
  initial: 'add' | 'withdraw';
  onSubmit: (kind: 'add' | 'withdraw', amount: number, note: string) => Promise<void>;
  onClose: () => void;
}

/** Окно операции с резервом: пополнить или потратить, назначение и сумма; баланс пересчитывается сразу */
export function ReserveSheet({ balance, initial, onSubmit, onClose }: Props) {
  const [kind, setKind] = useState<'add' | 'withdraw'>(initial);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const sum = toNum(amount);
  const after = Math.round((balance + (kind === 'add' ? sum : -sum)) * 100) / 100;
  const tooMuch = kind === 'withdraw' && sum > balance;

  async function submit() {
    if (busy) return;
    if (!sum) return setError('Введите сумму больше нуля');
    if (tooMuch) return setError('В резерве недостаточно средств');
    if (!note.trim()) return setError(kind === 'withdraw' ? 'Укажите, на что потрачены средства' : 'Укажите назначение');
    setError('');
    setBusy(true);
    try {
      await onSubmit(kind, sum, note.trim());
    } catch (e) {
      setError((e as Error).message || 'Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} label="Операция с резервом">
      <div className="sheet-title">Общий резерв</div>
      <div className="seg-pill wide" role="radiogroup" aria-label="Операция">
        <button role="radio" aria-checked={kind === 'add'} className={kind === 'add' ? 'active' : ''} onClick={() => setKind('add')}>
          Добавить деньги
        </button>
        <button role="radio" aria-checked={kind === 'withdraw'} className={kind === 'withdraw' ? 'active' : ''} onClick={() => setKind('withdraw')}>
          Убрать деньги
        </button>
      </div>

      <label className="field-label" htmlFor="r-note">{kind === 'withdraw' ? 'На что потрачены средства' : 'Назначение'}</label>
      <input
        id="r-note"
        className="field"
        value={note}
        maxLength={300}
        placeholder={kind === 'withdraw' ? 'Например: закупка материалов' : 'Например: взнос партнёра'}
        onChange={(e) => setNote(e.target.value)}
      />

      <label className="field-label" htmlFor="r-amount">Сумма, ₽</label>
      <input
        id="r-amount"
        className="field accent"
        inputMode="decimal"
        value={amount}
        placeholder="0"
        onChange={(e) => setAmount(cleanMoney(e.target.value))}
      />

      <div className="reserve-calc">
        <span>Сейчас в резерве: {fmtMoney(balance)}</span>
        <b className={tooMuch ? 'neg' : ''}>После: {fmtMoney(after)}</b>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      <button className="primary" onClick={submit} disabled={busy}>
        {busy ? 'Сохранение…' : kind === 'add' ? 'Добавить в резерв' : 'Списать из резерва'}
      </button>
      <button className="secondary cancel" onClick={onClose} disabled={busy}>
        Отмена
      </button>
    </Modal>
  );
}
