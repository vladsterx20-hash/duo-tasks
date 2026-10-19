import type { Period, ReserveEntry, Task, User } from '../types';
import { fmtDue, fmtMoney, fmtSigned, periodLabel, reserveOf, RESERVE_RATE } from '../utils';
import { Icon } from './Icon';

const PERIODS: [Period, string][] = [
  ['week', 'Неделя'],
  ['month', 'Месяц'],
  ['all', 'Всё время'],
];

/** Переключатель периода — только в «Прибыли с заказов» */
function PeriodPills({ period, onPeriod }: { period: Period; onPeriod: (p: Period) => void }) {
  return (
    <div className="seg-pill" role="tablist" aria-label="Период">
      {PERIODS.map(([k, label]) => (
        <button key={k} role="tab" aria-selected={period === k} className={period === k ? 'active' : ''} onClick={() => onPeriod(k)}>
          {label}
        </button>
      ))}
    </div>
  );
}

interface FundProps {
  doneAll: Task[]; // все завершённые задачи
  balance: number; // остаток резерва
  onOpenProfit: () => void;
  onOpenReserve: () => void;
}

/** «Фонд компании»: «Общий резерв» (крупно) и «Прибыль с заказов» */
export function FundScreen({ doneAll, balance, onOpenProfit, onOpenReserve }: FundProps) {
  const profit = doneAll.reduce((s, t) => s + (t.profit ?? 0), 0);
  return (
    <>
      <button className="reserve-card big" onClick={onOpenReserve} aria-label={`Общий резерв: ${fmtMoney(balance)}. Открыть подробности`}>
        <span className="card-chev dark">
          <Icon name="chevron" size={18} strokeWidth={2.6} />
        </span>
        <div className="reserve-head">
          <span className="reserve-label">Общий резерв</span>
        </div>
        <div className="reserve-sum">{fmtMoney(balance)}</div>
        <div className="reserve-sub">{Math.round(RESERVE_RATE * 100)}% с прибыли каждого выполненного заказа и ручные операции</div>
      </button>
      <button className="reserve-card dark" onClick={onOpenProfit} aria-label={`Прибыль с заказов: ${fmtMoney(profit)}. Открыть подробности`}>
        <span className="card-chev dark">
          <Icon name="chevron" size={18} strokeWidth={2.6} />
        </span>
        <div className="reserve-head">
          <span className="reserve-label">Прибыль с заказов</span>
        </div>
        <div className="reserve-sum">{fmtMoney(profit)}</div>
        <div className="reserve-sub">Завершённых задач: {doneAll.length}</div>
      </button>
    </>
  );
}

interface ProfitProps {
  tasks: Task[];
  period: Period;
  onPeriod: (p: Period) => void;
  onOpen: (t: Task) => void;
}

/** Подробности прибыли: какая сумма с какого заказа */
export function ProfitScreen({ tasks, period, onPeriod, onOpen }: ProfitProps) {
  const total = tasks.reduce((s, t) => s + (t.profit ?? 0), 0);
  return (
    <div className="done-list">
      <PeriodPills period={period} onPeriod={onPeriod} />
      <div className="reserve-card static dark">
        <div className="reserve-head">
          <span className="reserve-label">Прибыль с заказов</span>
        </div>
        <div className="reserve-sum">{fmtMoney(total)}</div>
        <div className="reserve-sub">Завершённых задач {periodLabel[period]}: {tasks.length}</div>
      </div>
      {tasks.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📭</div>
          <div className="empty-title">Пока ничего не завершено</div>
          <div className="muted">Завершённые задачи {periodLabel[period]} появятся здесь</div>
        </div>
      ) : (
        tasks.map((t) => {
          const p = t.profit ?? 0;
          return (
            <button key={t.id} className="card profit-row" onClick={() => onOpen(t)}>
              <span className="num on">{t.id}</span>
              <span className="card-body">
                <span className="card-title">{t.title}</span>
                {t.customer && <span className="card-customer ellipsis">{t.customer}</span>}
                <span className="card-due">Завершена: {fmtDue(t.completed_at)}</span>
              </span>
              <span className={'profit-amount' + (p < 0 ? ' neg' : '')}>{fmtSigned(p)}</span>
            </button>
          );
        })
      )}
    </div>
  );
}

interface ReserveProps {
  doneAll: Task[];
  entries: ReserveEntry[];
  users: User[];
  meId: number;
  balance: number;
  onOpen: (t: Task) => void;
  onOperation: (kind: 'add' | 'withdraw') => void;
  onDeleteEntry: (id: number) => void;
}

type Row =
  | { type: 'task'; at: number; task: Task }
  | { type: 'entry'; at: number; entry: ReserveEntry };

/** Общий резерв: остаток, кнопки «Добавить / Убрать деньги» и история (20% с заказов + ручные операции) */
export function ReserveScreen({ doneAll, entries, users, meId, balance, onOpen, onOperation, onDeleteEntry }: ReserveProps) {
  const rows: Row[] = [
    ...doneAll.filter((t) => reserveOf(t) > 0).map((t): Row => ({ type: 'task', at: +new Date(t.completed_at ?? 0), task: t })),
    ...entries.map((e): Row => ({ type: 'entry', at: +new Date(e.created_at), entry: e })),
  ].sort((a, b) => b.at - a.at);

  return (
    <div className="done-list">
      <div className="reserve-card static big">
        <div className="reserve-head">
          <span className="reserve-label">Общий резерв</span>
        </div>
        <div className="reserve-sum">{fmtMoney(balance)}</div>
        <div className="reserve-sub">
          {Math.round(RESERVE_RATE * 100)}% прибыли списывается автоматически, когда задача выполнена
        </div>
      </div>

      <div className="reserve-actions">
        <button className="primary small" onClick={() => onOperation('add')}>
          Добавить деньги
        </button>
        <button className="secondary small" onClick={() => onOperation('withdraw')}>
          Убрать деньги
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🏦</div>
          <div className="empty-title">Пока пусто</div>
          <div className="muted">Резерв пополняется выполненными заказами с прибылью и вашими операциями</div>
        </div>
      ) : (
        rows.map((r) => {
          if (r.type === 'task') {
            const t = r.task;
            return (
              <button key={'t' + t.id} className="card profit-row" onClick={() => onOpen(t)}>
                <span className="num on">{t.id}</span>
                <span className="card-body">
                  <span className="card-title">{t.title}</span>
                  {t.customer && <span className="card-customer ellipsis">{t.customer}</span>}
                  <span className="card-due">
                    {Math.round(RESERVE_RATE * 100)}% от прибыли {fmtMoney(t.profit ?? 0)} · {fmtDue(t.completed_at)}
                  </span>
                </span>
                <span className="profit-amount">{fmtSigned(reserveOf(t))}</span>
              </button>
            );
          }
          const e = r.entry;
          const who = e.author_id === meId ? 'Вы' : users.find((u) => u.id === e.author_id)?.first_name ?? '';
          const plus = e.kind === 'add';
          return (
            <div key={'e' + e.id} className="card profit-row entry-row">
              <span className={'num entry-sign' + (plus ? ' on' : '')}>{plus ? '+' : '−'}</span>
              <span className="card-body">
                <span className="card-title">{e.note}</span>
                <span className="card-due">
                  {plus ? 'Пополнение' : 'Расход'} · {who} · {fmtDue(e.created_at)}
                </span>
                {e.author_id === meId && (
                  <button className="entry-del" onClick={() => onDeleteEntry(e.id)}>
                    удалить
                  </button>
                )}
              </span>
              <span className={'profit-amount' + (plus ? '' : ' neg')}>{plus ? fmtSigned(e.amount) : fmtSigned(-e.amount)}</span>
            </div>
          );
        })
      )}
    </div>
  );
}
