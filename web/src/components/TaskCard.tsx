import { useRef, useState } from 'react';
import type { Task, User } from '../types';
import { assigneesOf, fmtDue, isOverdue } from '../utils';
import { Avatar, AvatarStack } from './Avatar';

interface Props {
  task: Task;
  users: User[];
  onOpen: () => void;
  onToggle: () => void;
}

const THRESHOLD = 80;

export function TaskCard({ task, users, onOpen, onToggle }: Props) {
  const [dx, setDx] = useState(0);
  const touch = useRef<{ x: number; y: number; dir?: 'h' | 'v' } | null>(null);
  const moved = useRef(false);
  const done = task.status === 'done';
  const author = users.find((u) => u.id === task.author_id);

  return (
    <div className="swipe-wrap">
      <div className={'swipe-bg' + (dx !== 0 ? ' show' : '')}>{done ? '↩ Вернуть' : '✓ Выполнено'}</div>
      <div
        className={'card prio-' + task.priority + (isOverdue(task) ? ' overdue' : '') + (done ? ' done' : '')}
        style={{ transform: `translateX(${dx}px)`, transition: touch.current ? 'none' : 'transform .2s' }}
        onClick={() => !moved.current && onOpen()}
        onTouchStart={(e) => {
          touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          moved.current = false;
        }}
        onTouchMove={(e) => {
          const t = touch.current;
          if (!t) return;
          const mx = e.touches[0].clientX - t.x;
          const my = e.touches[0].clientY - t.y;
          if (!t.dir && (Math.abs(mx) > 8 || Math.abs(my) > 8)) t.dir = Math.abs(mx) > Math.abs(my) ? 'h' : 'v';
          if (t.dir === 'h') {
            moved.current = true;
            setDx(Math.max(-130, Math.min(130, mx)));
          }
        }}
        onTouchEnd={() => {
          if (Math.abs(dx) > THRESHOLD) onToggle();
          touch.current = null;
          setDx(0);
        }}
      >
        <button
          className={'check' + (done ? ' on' : '')}
          aria-label={done ? 'Вернуть в новые' : 'Отметить выполненной'}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          {done && '✓'}
        </button>
        <div className="card-body">
          <div className="card-title">{task.title}</div>
          <div className="card-meta">
            <span className="due">🕒 {fmtDue(task.due_at)}</span>
            {task.priority === 'high' && <span className="prio-flag">🔥 Важно</span>}
            {task.priority === 'low' && <span>⬇ Низкий</span>}
            {task.attachments.length > 0 && <span title="Есть файлы">📎 {task.attachments.length}</span>}
            {task.comments.length > 0 && <span title="Комментарии">💬 {task.comments.length}</span>}
          </div>
        </div>
        <div className="card-people">
          <Avatar user={author} size={20} />
          <span className="arrow">→</span>
          <AvatarStack users={assigneesOf(task, users)} size={24} />
        </div>
      </div>
    </div>
  );
}
