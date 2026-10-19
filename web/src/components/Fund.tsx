import type { Period, Task, User } from '../types';
import { fmtDue, fmtMoney, fmtSigned, periodLabel, reserveOf, RESERVE_RATE } from '../utils';
import { CompletedList } from './CompletedList';
import { Icon } from './Icon';

const PERIODS: [Period, string][] = [
  ['week', 'Неделя'],
  ['month', 'Месяц'],
  ['all', 'Всё время'],
];

/** Переключатель периода — такой же, как был на главной */
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
  tasks: Task[]; // завершённые за выбранный период, новые сверху
  users: User[];
  period: Period;
  onPeriod: (p: Period) => void;
  onOpen: (t: Task) => void;
  onOpenReserve: () => void;
}

/** «Фонд компании»: прибыль с заказов и «Общий резерв» за выбранный период */
export function FundScreen({ tasks, users, period, onPeriod, onOpen, onOpenReserve }: FundProps) {
  const reserve = tasks.reduce((s, t) => s + reserveOf(t), 0);
  return (
    <>
      <PeriodPills period={period} onPeriod={onPeriod} />
      <CompletedList
        tasks={tasks}
        users={users}
        period={period}
        showProfit
        onOpen={onOpen}
        afterTotal={
          <button className="reserve-card" onClick={onOpenReserve} aria-label={`Общий резерв: ${fmtMoney(reserve)}. Открыть подробности`}>
            <span className="card-chev dark">
              <Icon name="chevron" size={18} strokeWidth={2.6} />
            </span>
            <div className="reserve-head">
              <Icon name="coin" size={20} />
              <span className="reserve-label">Общий резерв</span>
            </div>
            <div className="reserve-sum">{fmtMoney(reserve)}</div>
            <div className="reserve-sub">
              {Math.round(RESERVE_RATE * 100)}% с прибыли каждого выполненного заказа {periodLabel[period]}
            </div>
          </button>
        }
      />
    </>
  );
}

interface ReserveProps {
  tasks: Task[]; // завершённые за выбранный период
  period: Period;
  onPeriod: (p: Period) => void;
  onOpen: (t: Task) => void;
}

/** Подробности резерва: с какого заказа какая сумма поступила */
export function ReserveScreen({ tasks, period, onPeriod, onOpen }: ReserveProps) {
  const rows = tasks.filter((t) => reserveOf(t) > 0);
  const total = rows.reduce((s, t) => s + reserveOf(t), 0);
  return (
    <div className="done-list">
      <PeriodPills period={period} onPeriod={onPeriod} />
      <div className="reserve-card static">
        <div className="reserve-head">
          <Icon name="coin" size={20} />
          <span className="reserve-label">Общий резерв {periodLabel[period]}</span>
        </div>
        <div className="reserve-sum">{fmtMoney(total)}</div>
        <div className="reserve-sub">
          {Math.round(RESERVE_RATE * 100)}% прибыли списывается автоматически, когда задача выполнена. Заказов: {rows.length}
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🏦</div>
          <div className="empty-title">Пока пусто</div>
          <div className="muted">Резерв пополняется выполненными заказами с прибылью</div>
        </div>
      ) : (
        rows.map((t) => (
          <button key={t.id} className="card profit-row" onClick={() => onOpen(t)}>
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
        ))
      )}
    </div>
  );
}
