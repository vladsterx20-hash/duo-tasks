import { useMemo } from 'react';
import type { Period, Task, User } from '../types';
import { fmtMoney, periodFrom } from '../utils';
import { Icon } from './Icon';
import { PullToRefresh } from './PullToRefresh';
import { TaskCard } from './TaskCard';

const PERIODS: [Period, string][] = [
  ['week', 'Неделя'],
  ['month', 'Месяц'],
  ['all', 'Всё время'],
];

interface Props {
  tasks: Task[];
  users: User[];
  period: Period;
  onPeriod: (p: Period) => void;
  onOpen: (t: Task) => void;
  onTake: (t: Task) => void;
  onAll: () => void;
  /** Список завершённых задач за период (кнопка «Сделанные задачи») */
  onOpenDone: () => void;
  /** Завершённые задачи с прибылью по каждой (кнопка «Прибыль с заказов») */
  onOpenProfit: () => void;
  onRefresh: () => Promise<void>;
}

export function Home({ tasks, users, period, onPeriod, onOpen, onTake, onAll, onOpenDone, onOpenProfit, onRefresh }: Props) {
  // Прибыль и «сделанные» — только завершённые задачи, по дате завершения в выбранном периоде
  const { profit, doneCount } = useMemo(() => {
    const from = periodFrom(period);
    const inPeriod = tasks.filter((t) => t.status === 'done' && t.completed_at && new Date(t.completed_at).getTime() >= from);
    return { profit: inPeriod.reduce((s, t) => s + (t.profit ?? 0), 0), doneCount: inPeriod.length };
  }, [tasks, period]);

  const activeCount = tasks.filter((t) => t.status !== 'done').length;

  const upcoming = useMemo(() => {
    const due = (t: Task) => (t.due_at ? new Date(t.due_at).getTime() : Infinity);
    return tasks
      .filter((t) => t.status !== 'done')
      .sort((a, b) => due(a) - due(b))
      .slice(0, 5);
  }, [tasks]);

  return (
    <PullToRefresh onRefresh={onRefresh}>
      <div className="seg-pill" role="tablist" aria-label="Период">
        {PERIODS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={period === k} className={period === k ? 'active' : ''} onClick={() => onPeriod(k)}>
            {label}
          </button>
        ))}
      </div>

      <button className="profit-card" onClick={onOpenProfit} aria-label={`Прибыль с заказов: ${fmtMoney(profit)}. Открыть список`}>
        <span className="card-chev">
          <Icon name="chevron" size={20} strokeWidth={2.6} />
        </span>
        <div className="profit-label">Прибыль с заказов</div>
        <div className="profit-sum">{fmtMoney(profit)}</div>
      </button>

      <div className="stats">
        <button className="stat" onClick={onOpenDone} aria-label={`Сделанные задачи: ${doneCount}. Открыть список`}>
          <span className="card-chev dark">
            <Icon name="chevron" size={18} strokeWidth={2.6} />
          </span>
          <div className="stat-label">
            Сделанные
            <br />
            задачи
          </div>
          <div className="stat-num">{doneCount}</div>
        </button>
        <button className="stat" onClick={onAll} aria-label={`Активные задачи: ${activeCount}. Перейти к задачам`}>
          <span className="card-chev dark">
            <Icon name="chevron" size={18} strokeWidth={2.6} />
          </span>
          <div className="stat-label">
            Активные
            <br />
            задачи
          </div>
          <div className="stat-num">{activeCount}</div>
        </button>
      </div>

      <div className="section-head">
        <h2 className="caps">Ближайшие задачи</h2>
        <button className="link-orange" onClick={onAll}>
          Все
        </button>
      </div>
      {upcoming.length === 0 ? (
        <div className="empty small">
          <div className="empty-title">Нет активных задач</div>
          <div className="muted">Добавьте новую на вкладке «Задачи»</div>
        </div>
      ) : (
        upcoming.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            users={users}
            compact
            onOpen={() => onOpen(t)}
            onTake={() => onTake(t)}
          />
        ))
      )}
    </PullToRefresh>
  );
}
