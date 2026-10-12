import type { Task, User } from '../types';
import { assigneesOf, fmtDue, isOverdue } from '../utils';
import { AvatarStack } from './Avatar';
import { Icon } from './Icon';

interface Props {
  task: Task;
  users: User[];
  onOpen: () => void;
  onTake: () => void;
  onComplete: () => void;
  /** компактный вариант для главной (без кнопок действий) */
  compact?: boolean;
}

export function TaskCard({ task, users, onOpen, onTake, onComplete, compact }: Props) {
  const done = task.status === 'done';

  return (
    <div
      className={'card' + (isOverdue(task) ? ' overdue' : '') + (done ? ' done' : '')}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
    >
      <div className="card-main">
        <span className={'num' + (done ? ' on' : '') + (task.status === 'in_progress' ? ' work' : '')} aria-label={`Задача номер ${task.id}`}>
          {task.id}
        </span>
        <div className="card-body">
          <div className="card-title">{task.title}</div>
          {task.customer && <div className="card-customer ellipsis">{task.customer}</div>}
          <div className="card-due">
            <Icon name="clock" size={14} />
            <span className="due">{fmtDue(task.due_at)}</span>
            {task.priority === 'high' && <span aria-label="Высокий приоритет">🔥</span>}
          </div>
        </div>
        <AvatarStack users={assigneesOf(task, users)} size={34} />
      </div>
      {!compact && task.status === 'new' && (
        <button
          className="take-btn"
          onClick={(e) => {
            e.stopPropagation();
            onTake();
          }}
        >
          Взять в работу
        </button>
      )}
      {!compact && task.status === 'in_progress' && (
        <button
          className="take-btn finish"
          onClick={(e) => {
            e.stopPropagation();
            onComplete();
          }}
        >
          Завершить задачу
        </button>
      )}
    </div>
  );
}
