import { useMemo, useState } from 'react';
import { PRIORITY_WEIGHT } from '../types';
import type { Status, Task, User } from '../types';
import { Icon } from './Icon';
import { PullToRefresh } from './PullToRefresh';
import { TaskCard } from './TaskCard';

const TABS: [Status, string][] = [
  ['new', 'Новые'],
  ['in_progress', 'В работе'],
  ['done', 'Завершённые'],
];

interface Props {
  tasks: Task[];
  users: User[];
  meId: number;
  tab: Status;
  onTab: (s: Status) => void;
  onOpen: (t: Task) => void;
  onTake: (t: Task) => void;
  onComplete: (t: Task) => void;
  onNew: () => void;
  onRefresh: () => Promise<void>;
}

export function TasksScreen({ tasks, users, meId, tab, onTab, onOpen, onTake, onComplete, onNew, onRefresh }: Props) {
  const [who, setWho] = useState<'all' | 'me' | 'partner'>('all');
  const [onlyHigh, setOnlyHigh] = useState(false);
  const partner = users.find((u) => u.id !== meId);

  const filtered = useMemo(
    () =>
      tasks.filter((t) => {
        if (onlyHigh && t.priority !== 'high') return false;
        if (who === 'me') return t.assignee_id === null || t.assignee_id === meId;
        if (who === 'partner') return t.assignee_id === null || t.assignee_id !== meId;
        return true;
      }),
    [tasks, who, onlyHigh, meId]
  );

  const visible = useMemo(() => {
    const list = filtered.filter((t) => t.status === tab);
    const due = (t: Task) => (t.due_at ? new Date(t.due_at).getTime() : Infinity);
    if (tab === 'done') return list.sort((a, b) => +new Date(b.completed_at ?? 0) - +new Date(a.completed_at ?? 0));
    return list.sort((a, b) => due(a) - due(b) || PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]);
  }, [filtered, tab]);

  const count = (s: Status) => filtered.filter((t) => t.status === s).length;
  const filterActive = who !== 'all' || onlyHigh;

  return (
    <>
      <PullToRefresh onRefresh={onRefresh}>
        <div className="seg-pill" role="tablist" aria-label="Статус задач">
          {TABS.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => onTab(k)}>
              {label}
              <span className="badge">{count(k)}</span>
            </button>
          ))}
        </div>

        <div className="filters">
          {([['all', 'Все'], ['me', 'Мои'], ['partner', partner?.first_name ?? 'Партнёр']] as const).map(([k, label]) => (
            <button key={k} className={'fchip' + (who === k ? ' active' : '')} onClick={() => setWho(k)}>
              {label}
            </button>
          ))}
          <button className={'fchip' + (onlyHigh ? ' active' : '')} onClick={() => setOnlyHigh(!onlyHigh)}>
            🔥 Важные
          </button>
        </div>

        {visible.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">{filterActive ? '🔎' : tab === 'done' ? '📭' : tab === 'new' ? '🎉' : '🛠'}</div>
            <div className="empty-title">
              {filterActive
                ? 'Ничего не найдено'
                : tab === 'new'
                  ? 'Новых задач нет'
                  : tab === 'in_progress'
                    ? 'Ничего не в работе'
                    : 'Пока ничего не завершено'}
            </div>
            <div className="muted">{filterActive ? 'Попробуйте сменить фильтр' : 'Задачи появятся здесь'}</div>
          </div>
        ) : (
          visible.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              users={users}
              onOpen={() => onOpen(t)}
              onTake={() => onTake(t)}
              onComplete={() => onComplete(t)}
            />
          ))
        )}
      </PullToRefresh>
      <button className="new-task-btn" onClick={onNew}>
        <Icon name="plus" size={18} strokeWidth={3} /> Новая задача
      </button>
    </>
  );
}
