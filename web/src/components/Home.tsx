import { useMemo } from 'react';
import type { Task, User } from '../types';
import { Icon } from './Icon';
import { PullToRefresh } from './PullToRefresh';
import { TaskCard } from './TaskCard';

interface Props {
  tasks: Task[];
  users: User[];
  meName: string;
  onOpen: (t: Task) => void;
  onTake: (t: Task) => void;
  onAll: () => void;
  onNew: () => void;
  /** Список завершённых задач (кнопка «Сделанные задачи») */
  onOpenDone: () => void;
  /** «Фонд компании»: прибыль с заказов и общий резерв */
  onOpenFund: () => void;
  onRefresh: () => Promise<void>;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

export function Home({ tasks, users, meName, onOpen, onTake, onAll, onNew, onOpenDone, onOpenFund, onRefresh }: Props) {
  const active = useMemo(() => tasks.filter((t) => t.status !== 'done'), [tasks]);

  const upcoming = useMemo(() => {
    const due = (t: Task) => (t.due_at ? new Date(t.due_at).getTime() : Infinity);
    return [...active].sort((a, b) => due(a) - due(b)).slice(0, 5);
  }, [active]);

  const today = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <PullToRefresh onRefresh={onRefresh}>
      <div className="hello">
        <div className="hello-name">
          {greeting()}
          {meName ? `, ${meName}` : ''}!
        </div>
        <div className="hello-date">{today}</div>
      </div>

      <div className="home-tiles">
        <button className="tile light" onClick={onOpenDone} aria-label="Сделанные задачи. Открыть список">
          <span className="tile-ic">
            <Icon name="check" size={22} strokeWidth={2.8} />
          </span>
          <span className="tile-label">
            <b>Сделанные</b>
            <small>задачи</small>
          </span>
        </button>
        <button className="tile accent" onClick={onOpenFund} aria-label="Фонд компании. Открыть">
          <span className="tile-ic">
            <Icon name="coin" size={22} />
          </span>
          <span className="tile-label">
            <b>Фонд</b>
            <small>компании</small>
          </span>
        </button>
        <button className="tile dark" onClick={onNew} aria-label="Новая задача">
          <span className="tile-ic">
            <Icon name="plus" size={24} strokeWidth={2.8} />
          </span>
          <span className="tile-label">
            <b>Новая</b>
            <small>задача</small>
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
          <div className="muted">Добавьте новую кнопкой выше</div>
        </div>
      ) : (
        upcoming.map((t) => (
          <TaskCard key={t.id} task={t} users={users} compact statusDot onOpen={() => onOpen(t)} onTake={() => onTake(t)} />
        ))
      )}
    </PullToRefresh>
  );
}
