import { useMemo, useState } from 'react';
import { PRIORITY_WEIGHT } from '../types';
import type { ActiveTab, Task, User } from '../types';
import { Icon } from './Icon';
import { PullToRefresh } from './PullToRefresh';
import { TaskCard } from './TaskCard';

const TABS: [ActiveTab, string][] = [
  ['new', 'Новые'],
  ['in_progress', 'В работе'],
];

interface Props {
  tasks: Task[];
  users: User[];
  meId: number;
  tab: ActiveTab;
  onTab: (s: ActiveTab) => void;
  onOpen: (t: Task) => void;
  onTake: (t: Task) => void;
  onMap: () => void;
  onRefresh: () => Promise<void>;
}

export function TasksScreen({ tasks, users, meId, tab, onTab, onOpen, onTake, onMap, onRefresh }: Props) {
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
    return list.sort((a, b) => due(a) - due(b) || PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]);
  }, [filtered, tab]);

  const count = (s: ActiveTab) => filtered.filter((t) => t.status === s).length;
  const filterActive = who !== 'all' || onlyHigh;

  return (
    <>
      <PullToRefresh onRefresh={onRefresh}>
        <div className="seg-pill two" role="tablist" aria-label="Статус задач">
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
            <div className="empty-icon">{filterActive ? '🔎' : tab === 'new' ? '🎉' : '🛠'}</div>
            <div className="empty-title">
              {filterActive ? 'Ничего не найдено' : tab === 'new' ? 'Новых задач нет' : 'Ничего не в работе'}
            </div>
            <div className="muted">{filterActive ? 'Попробуйте сменить фильтр' : 'Задачи появятся здесь'}</div>
          </div>
        ) : (
          visible.map((t) => <TaskCard key={t.id} task={t} users={users} onOpen={() => onOpen(t)} onTake={() => onTake(t)} />)
        )}
      </PullToRefresh>

      {/* Кнопка «На карте» слева над меню — как в примере */}
      <button className="float-btn left" onClick={onMap}>
        <Icon name="map" size={18} strokeWidth={2.4} /> На карте
      </button>
    </>
  );
}
