import { useMemo } from 'react';
import type { HomeOrder, Task, User } from '../types';
import { Icon } from './Icon';
import { PullToRefresh } from './PullToRefresh';
import { SortableList } from './Sortable';
import { TaskCard } from './TaskCard';

interface Props {
  tasks: Task[];
  users: User[];
  meName: string;
  /** id закреплённых задач (порядок — новые закрепы сверху) */
  pins: number[];
  /** свой порядок карточек в «Закреплённых» и «Ближайших» */
  order: HomeOrder;
  onReorder: (section: keyof HomeOrder, ids: number[]) => void;
  /** нажатие на номер задачи — быстрое меню действий */
  onNumber: (t: Task) => void;
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

export function Home({ tasks, users, meName, pins, order, onReorder, onNumber, onOpen, onTake, onAll, onNew, onOpenDone, onOpenFund, onRefresh }: Props) {
  const active = useMemo(() => tasks.filter((t) => t.status !== 'done'), [tasks]);

  // Закреплённые — в порядке закрепления; завершённые из закрепа выпадают сами
  // Свой порядок: сохранённые идут как поставил пользователь, новые (без сохранённого места) — сверху
  const byOrder = (list: Task[], saved: number[]) =>
    [...list].sort((a, b) => {
      const pa = saved.indexOf(a.id);
      const pb = saved.indexOf(b.id);
      if (pa < 0 && pb < 0) return 0;
      if (pa < 0) return -1;
      if (pb < 0) return 1;
      return pa - pb;
    });

  const pinned = useMemo(
    () => byOrder(pins.map((id) => active.find((t) => t.id === id)).filter((t): t is Task => !!t), order.pinned),
    [pins, active, order.pinned]
  );

  // «Ближайшие» — все остальные активные, закреплённые выше не дублируем
  const upcoming = useMemo(() => {
    const due = (t: Task) => (t.due_at ? new Date(t.due_at).getTime() : Infinity);
    const five = active
      .filter((t) => !pins.includes(t.id))
      .sort((a, b) => due(a) - due(b))
      .slice(0, 5);
    return byOrder(five, order.upcoming);
  }, [active, pins, order.upcoming]);

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
            <Icon name="wallet" size={22} />
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

      {pinned.length > 0 && (
        <>
          <div className="section-head">
            <h2 className="caps">Закреплённые</h2>
          </div>
          <SortableList
            items={pinned}
            getId={(t) => t.id}
            onReorder={(ids) => onReorder('pinned', ids)}
            render={(t) => (
              <TaskCard
                task={t}
                users={users}
                compact
                statusDot
                pinned
                onNumber={() => onNumber(t)}
                onOpen={() => onOpen(t)}
                onTake={() => onTake(t)}
              />
            )}
          />
        </>
      )}

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
        <SortableList
          items={upcoming}
          getId={(t) => t.id}
          onReorder={(ids) => onReorder('upcoming', ids)}
          render={(t) => (
            <TaskCard task={t} users={users} compact statusDot onNumber={() => onNumber(t)} onOpen={() => onOpen(t)} onTake={() => onTake(t)} />
          )}
        />
      )}
    </PullToRefresh>
  );
}
