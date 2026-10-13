import type { Period, Task, User } from '../types';
import { fmtDue, fmtMoney, fmtSigned, periodLabel } from '../utils';
import { TaskCard } from './TaskCard';

interface Props {
  tasks: Task[]; // уже отфильтрованы по периоду, новые завершённые сверху
  users: User[];
  period: Period;
  /** true — «Прибыль с заказов»: сколько принесла каждая задача и итог */
  showProfit: boolean;
  onOpen: (t: Task) => void;
}

export function CompletedList({ tasks, users, period, showProfit, onOpen }: Props) {
  const total = tasks.reduce((s, t) => s + (t.profit ?? 0), 0);

  return (
    <div className="done-list">
      {showProfit && (
        <div className="profit-card static" aria-label="Итого">
          <div className="profit-label">Итого {periodLabel[period]}</div>
          <div className="profit-sum">{fmtMoney(total)}</div>
          <div className="profit-count">Завершённых задач: {tasks.length}</div>
        </div>
      )}
      {!showProfit && <div className="muted done-sub">Завершённые задачи {periodLabel[period]}: {tasks.length}</div>}

      {tasks.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📭</div>
          <div className="empty-title">Пока ничего не завершено</div>
          <div className="muted">Завершённые задачи {periodLabel[period]} появятся здесь</div>
        </div>
      ) : showProfit ? (
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
      ) : (
        tasks.map((t) => <TaskCard key={t.id} task={t} users={users} compact onOpen={() => onOpen(t)} onTake={() => {}} />)
      )}
    </div>
  );
}
