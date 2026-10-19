import { useMemo } from 'react';
import type { ActiveTab, Task, User } from '../types';
import { fmtDue, isOverdue } from '../utils';
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
  /** Открыть раздел «Задачи» на нужной вкладке */
  onTasks: (tab: ActiveTab) => void;
  onNew: () => void;
  /** Список завершённых задач (кнопка «Сделанные задачи») */
  onOpenDone: () => void;
  /** «Фонд компании»: прибыль с заказов и общий резерв */
  onOpenFund: () => void;
  onRefresh: () => Promise<void>;
}

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

export function Home({ tasks, users, meName, onOpen, onTake, onAll, onTasks, onNew, onOpenDone, onOpenFund, onRefresh }: Props) {
  const active = useMemo(() => tasks.filter((t) => t.status !== 'done'), [tasks]);
  const newCount = active.filter((t) => t.status === 'new').length;
  const workCount = active.filter((t) => t.status === 'in_progress').length;
  const overdue = active.filter(isOverdue);

  const upcoming = useMemo(() => {
    const due = (t: Task) => (t.due_at ? new Date(t.due_at).getTime() : Infinity);
    return [...active].sort((a, b) => due(a) - due(b)).slice(0, 5);
  }, [active]);

  const next = upcoming.find((t) => t.due_at && !isOverdue(t));
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

      <section className="hero" aria-label="Сводка по задачам">
        <div className="hero-label">Сейчас в работе</div>
        <div className="hero-big">
          {active.length} {plural(active.length, 'активная задача', 'активные задачи', 'активных задач')}
        </div>
        <div className="hero-sub">
          {overdue.length > 0
            ? `Просрочено: ${overdue.length}`
            : next
              ? `Ближайший срок: ${fmtDue(next.due_at)}`
              : active.length > 0
                ? 'Сроков нет'
                : 'Все задачи выполнены'}
        </div>
        <div className="hero-counters">
          <button className="hero-count" onClick={() => onTasks('new')}>
            <b>{newCount}</b>
            <span>Новые</span>
          </button>
          <button className="hero-count" onClick={() => onTasks('in_progress')}>
            <b>{workCount}</b>
            <span>В работе</span>
          </button>
          <button
            className={'hero-count' + (overdue.length > 0 ? ' alert' : '')}
            onClick={() => onTasks(overdue[0]?.status === 'in_progress' ? 'in_progress' : 'new')}
          >
            <b>{overdue.length}</b>
            <span>Просрочено</span>
          </button>
        </div>
      </section>

      <button className="quick-add" onClick={onNew}>
        <Icon name="plus" size={20} strokeWidth={2.8} />
        Новая задача
      </button>

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
          <div className="muted">Добавьте новую кнопкой выше</div>
        </div>
      ) : (
        upcoming.map((t) => (
          <TaskCard key={t.id} task={t} users={users} compact onOpen={() => onOpen(t)} onTake={() => onTake(t)} />
        ))
      )}
    </PullToRefresh>
  );
}
