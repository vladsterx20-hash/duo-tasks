import { useMemo, useState } from 'react';
import type { Task, User } from '../types';
import { fmtMoney } from '../utils';
import { PullToRefresh } from './PullToRefresh';
import { TaskCard } from './TaskCard';

type Period = 'week' | 'month' | 'all';
const PERIODS: [Period, string][] = [
  ['week', 'Неделя'],
  ['month', 'Месяц'],
  ['all', 'Всё время'],
];
const DAY = 86_400_000;

interface Props {
  tasks: Task[];
  users: User[];
  onOpen: (t: Task) => void;
  onTake: (t: Task) => void;
  onComplete: (t: Task) => void;
  onAll: () => void;
  onRefresh: () => Promise<void>;
}

export function Home({ tasks, users, onOpen, onTake, onComplete, onAll, onRefresh }: Props) {
  const [period, setPeriod] = useState<Period>('month');

  // Прибыль и «сделанные» — только завершённые задачи, по дате завершения в выбранном периоде
  const { profit, doneCount } = useMemo(() => {
    const from = period === 'all' ? 0 : Date.now() - (period === 'week' ? 7 : 30) * DAY;
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
          <button key={k} role="tab" aria-selected={period === k} className={period === k ? 'active' : ''} onClick={() => setPeriod(k)}>
            {label}
          </button>
        ))}
      </div>

      <section className="profit-card" aria-label="Прибыль с заказов">
        <div className="profit-label">Прибыль с заказов</div>
        <div className="profit-sum">{fmtMoney(profit)}</div>
      </section>

      <div className="stats">
        <div className="stat">
          <div className="stat-label">Сделанные задачи</div>
          <div className="stat-num">{doneCount}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Активные задачи</div>
          <div className="stat-num">{activeCount}</div>
        </div>
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
            onComplete={() => onComplete(t)}
          />
        ))
      )}
    </PullToRefresh>
  );
}
