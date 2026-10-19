import { useMemo } from 'react';
import type { Task, User } from '../types';
import { Icon } from './Icon';
import { PullToRefresh } from './PullToRefresh';
import { TaskCard } from './TaskCard';

interface Props {
  tasks: Task[];
  users: User[];
  onOpen: (t: Task) => void;
  onTake: (t: Task) => void;
  onAll: () => void;
  /** Список завершённых задач (кнопка «Сделанные задачи») */
  onOpenDone: () => void;
  /** «Фонд компании»: прибыль с заказов и общий резерв */
  onOpenFund: () => void;
  onRefresh: () => Promise<void>;
}

export function Home({ tasks, users, onOpen, onTake, onAll, onOpenDone, onOpenFund, onRefresh }: Props) {
  const upcoming = useMemo(() => {
    const due = (t: Task) => (t.due_at ? new Date(t.due_at).getTime() : Infinity);
    return tasks
      .filter((t) => t.status !== 'done')
      .sort((a, b) => due(a) - due(b))
      .slice(0, 5);
  }, [tasks]);

  return (
    <PullToRefresh onRefresh={onRefresh}>
      <div className="home-btns">
        <button className="home-btn light" onClick={onOpenDone} aria-label="Сделанные задачи. Открыть список">
          <span className="home-btn-label">Сделанные задачи</span>
          <span className="home-btn-chev">
            <Icon name="chevron" size={20} strokeWidth={2.6} />
          </span>
        </button>
        <button className="home-btn accent" onClick={onOpenFund} aria-label="Фонд компании. Открыть">
          <span className="home-btn-label">Фонд компании</span>
          <span className="home-btn-chev">
            <Icon name="chevron" size={20} strokeWidth={2.6} />
          </span>
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
