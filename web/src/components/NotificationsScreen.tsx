import type { AppNotification } from '../types';
import { fmtDue } from '../utils';

const ICON: Record<AppNotification['kind'], string> = { assigned: '📝', taken: '🛠', done: '✅', comment: '💬', chat: '🗨' };

interface Props {
  items: AppNotification[];
  onOpenTask: (id: number) => void;
}

export function NotificationsScreen({ items, onOpenTask }: Props) {
  if (items.length === 0)
    return (
      <div className="empty">
        <div className="empty-icon">🔕</div>
        <div className="empty-title">Уведомлений пока нет</div>
        <div className="muted">Здесь будут новые задачи, комментарии и выполненные задачи</div>
      </div>
    );

  return (
    <div className="notif-list">
      {items.map((n) => (
        <button
          key={n.id}
          className={'notif' + (n.read ? '' : ' unread')}
          disabled={n.task_id === null}
          onClick={() => n.task_id !== null && onOpenTask(n.task_id)}
        >
          <span className="notif-icon">{ICON[n.kind]}</span>
          <span className="notif-text">
            <span>{n.text}</span>
            <span className="muted">{fmtDue(n.created_at)}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
