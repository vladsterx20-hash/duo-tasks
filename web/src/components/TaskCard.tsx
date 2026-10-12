import type { Task, User } from '../types';
import { assigneesOf, fmtDue, isOverdue } from '../utils';
import { Icon } from './Icon';

interface Props {
  task: Task;
  users: User[];
  onOpen: () => void;
  onTake: () => void;
  onComplete: () => void;
  /** компактный вариант для главной */
  compact?: boolean;
}

export function TaskCard({ task, users, onOpen, onTake, onComplete, compact }: Props) {
  const who = assigneesOf(task, users)
    .map((u) => u.first_name)
    .join(' и ');
  const done = task.status === 'done';
  const inProgress = task.status === 'in_progress';

  const circleLabel = done ? 'Завершена' : inProgress ? 'Завершить задачу' : 'Взять в работу';

  return (
    <div
      className={'card prio-' + task.priority + (isOverdue(task) ? ' overdue' : '') + (done ? ' done' : '')}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
    >
      <div className="card-main">
        <button
          className={'circle' + (done ? ' on' : '') + (inProgress ? ' work' : '')}
          aria-label={circleLabel}
          disabled={done}
          onClick={(e) => {
            e.stopPropagation();
            if (inProgress) onComplete();
            else if (!done) onTake();
          }}
        >
          {(done || inProgress) && <Icon name="check" size={16} strokeWidth={3} />}
        </button>
        <div className="card-body">
          <div className="card-title">{task.title}</div>
          {task.customer && <div className="card-customer ellipsis">Заказчик: {task.customer}</div>}
          <div className="card-meta">
            <span className="due">{fmtDue(task.due_at)}</span>
            <span aria-hidden="true">·</span>
            <span className="who">{who}</span>
            {task.priority === 'high' && <span className="prio-flag">🔥</span>}
          </div>
        </div>
        <span className="card-icon" aria-label={task.attachments.length ? 'Есть файлы' : undefined}>
          <Icon name={task.attachments.length ? 'clip' : 'list'} size={16} />
        </span>
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
    </div>
  );
}
