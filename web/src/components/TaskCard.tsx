import type { Task, User } from '../types';
import { assigneesOf, fmtDue, isOverdue, statusLabel } from '../utils';
import { AvatarStack } from './Avatar';
import { Icon } from './Icon';

interface Props {
  task: Task;
  users: User[];
  onOpen: () => void;
  onTake: () => void;
  /** компактный вариант для главной (без кнопок действий) */
  compact?: boolean;
  /** огонёк статуса в углу карточки — только на главной */
  statusDot?: boolean;
  /** задача закреплена на главной — значок кнопки в углу */
  pinned?: boolean;
  /** нажатие на номер: быстрое меню действий (если не задано — номер просто метка) */
  onNumber?: () => void;
}

export function TaskCard({ task, users, onOpen, onTake, compact, statusDot, pinned, onNumber }: Props) {
  const done = task.status === 'done';
  const important = task.priority === 'high' && !done;

  return (
    <div
      className={'card' + (isOverdue(task) ? ' overdue' : '') + (done ? ' done' : '')}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
    >
      {statusDot && <span className={'status-dot ' + task.status} title={statusLabel[task.status]} aria-label={statusLabel[task.status]} />}
      {pinned && (
        <span className="pin-mark" role="img" aria-label="Закреплена">
          <Icon name="pin" size={13} />
        </span>
      )}
      <div className="card-main">
        {/* Важная задача: вместо номера в квадрате — огонёк */}
        {onNumber ? (
          <button
            type="button"
            data-nodrag
            className={'num' + (done ? ' on' : '') + (task.status === 'in_progress' ? ' work' : '') + (important ? ' num-fire' : '')}
            aria-label={`Быстрые действия: задача номер ${task.id}`}
            aria-haspopup="menu"
            title={important ? 'Важная задача' : 'Быстрые действия'}
            onClick={(e) => {
              e.stopPropagation();
              onNumber();
            }}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {important && <span className="flame-shape" aria-hidden="true" />}
            <span className="num-text">{task.id}</span>
          </button>
        ) : (
          <span
            className={'num' + (done ? ' on' : '') + (task.status === 'in_progress' ? ' work' : '') + (important ? ' num-fire' : '')}
            aria-label={`Задача номер ${task.id}${important ? ', важная' : ''}`}
            title={important ? 'Важная задача' : undefined}
          >
            {important && <span className="flame-shape" aria-hidden="true" />}
            <span className="num-text">{task.id}</span>
          </span>
        )}
        <div className="card-body">
          <div className="card-title">{task.title}</div>
          {task.customer && <div className="card-customer ellipsis">{task.customer}</div>}
          <div className="card-due">
            <Icon name="clock" size={14} />
            <span className="due">{fmtDue(task.due_at)}</span>
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
    </div>
  );
}
