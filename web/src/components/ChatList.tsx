import { useMemo } from 'react';
import type { Task, User } from '../types';
import { PullToRefresh } from './PullToRefresh';

interface Props {
  tasks: Task[];
  users: User[];
  meId: number;
  unread: (t: Task) => number;
  onOpen: (t: Task) => void;
  onRefresh: () => Promise<void>;
}

/** Время последнего сообщения: сегодня — часы и минуты, иначе дата */
function fmtShort(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

/** Список задач как список чатов: номер, название, последнее сообщение, непрочитанные */
export function ChatList({ tasks, users, meId, unread, onOpen, onRefresh }: Props) {
  const rows = useMemo(() => {
    const last = (t: Task) => t.chat[t.chat.length - 1];
    // Сверху — задачи с самым свежим сообщением; без сообщений — по номеру (новые выше)
    return [...tasks].sort((a, b) => {
      const la = last(a) ? +new Date(last(a).created_at) : 0;
      const lb = last(b) ? +new Date(last(b).created_at) : 0;
      return lb - la || b.id - a.id;
    });
  }, [tasks]);

  if (tasks.length === 0)
    return (
      <div className="empty">
        <div className="empty-icon">💬</div>
        <div className="empty-title">Чатов пока нет</div>
        <div className="muted">Создайте задачу, и её можно будет обсудить здесь</div>
      </div>
    );

  return (
    <PullToRefresh onRefresh={onRefresh}>
      <div className="chat-list">
        {rows.map((t) => {
          const m = t.chat[t.chat.length - 1];
          const n = unread(t);
          const who = m ? (m.author_id === meId ? 'Вы' : users.find((u) => u.id === m.author_id)?.first_name ?? '') : '';
          return (
            <button key={t.id} className={'card chat-row' + (t.status === 'done' ? ' done' : '')} onClick={() => onOpen(t)}>
              <span className={'num' + (t.status === 'done' ? ' on' : '')} aria-hidden="true">
                {t.id}
              </span>
              <span className="chat-row-body">
                <span className="chat-row-title ellipsis">{t.title}</span>
                <span className={'chat-row-last ellipsis' + (m ? '' : ' none')}>
                  {m ? `${who}: ${m.text || (m.attachments?.length ? `📎 ${m.attachments[0].file_name}` : '')}` : 'Сообщений пока нет'}
                </span>
              </span>
              <span className="chat-row-meta">
                {m && <span className="chat-row-time">{fmtShort(m.created_at)}</span>}
                {n > 0 && (
                  <span className="unread-badge" aria-label={`Непрочитанных: ${n}`}>
                    {n}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </PullToRefresh>
  );
}
