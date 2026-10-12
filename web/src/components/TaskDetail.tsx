import { useState } from 'react';
import WebApp from '@twa-dev/sdk';
import { PRIORITY_LABEL } from '../types';
import type { Task, User } from '../types';
import { assigneesOf, fmtDue, fmtSize, inTelegram, isOverdue, openFile } from '../utils';
import { Avatar } from './Avatar';

interface Props {
  task: Task;
  users: User[];
  meId: number;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onComment: (text: string) => Promise<void>;
  onDeleteComment: (id: number) => void;
}

export function TaskDetail({ task, users, meId, onEdit, onDelete, onToggle, onComment, onDeleteComment }: Props) {
  const author = users.find((u) => u.id === task.author_id);
  const done = task.status === 'done';
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  async function send() {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await onComment(text.trim());
      setText('');
    } finally {
      setSending(false);
    }
  }

  function confirmDelete() {
    if (inTelegram()) WebApp.showConfirm('Удалить задачу безвозвратно?', (ok) => ok && onDelete());
    else if (confirm('Удалить задачу безвозвратно?')) onDelete();
  }

  return (
    <div className="screen detail">
      <h1 className={done ? 'struck' : ''}>{task.title}</h1>

      <div className="chips">
        <div className={'chip' + (isOverdue(task) ? ' overdue' : '')}>🕒 {fmtDue(task.due_at)}</div>
        <div className={'chip prio-chip-' + task.priority}>
          {task.priority === 'high' ? '🔥 ' : ''}Приоритет: {PRIORITY_LABEL[task.priority].toLowerCase()}
        </div>
      </div>

      <div className="people-row">
        <div>
          <span className="muted">Автор</span>
          <div className="person"><Avatar user={author} size={28} /> {author?.first_name}</div>
        </div>
        <div>
          <span className="muted">Исполнитель</span>
          <div className="person">
            {assigneesOf(task, users).map((u) => (
              <span key={u.id} className="person"><Avatar user={u} size={28} /> {u.first_name}</span>
            ))}
          </div>
        </div>
      </div>

      {task.description && <p className="desc">{task.description}</p>}

      {task.attachments.length > 0 && (
        <>
          <h2>Файлы</h2>
          <div className="files">
            {task.attachments.map((a) => (
              <button key={a.id} className="file-item link" onClick={() => openFile(a.file_url)}>
                {a.file_type.startsWith('image/') ? <img src={a.file_url} alt="" /> : <span className="file-icon">📄</span>}
                <span className="file-name">{a.file_name}</span>
                <span className="muted">{fmtSize(a.size)}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <h2>Комментарии{task.comments.length > 0 ? ` · ${task.comments.length}` : ''}</h2>
      <div className="comments">
        {task.comments.length === 0 && <div className="muted">Пока нет комментариев</div>}
        {task.comments.map((c) => {
          const u = users.find((x) => x.id === c.author_id);
          const mine = c.author_id === meId;
          return (
            <div key={c.id} className={'comment' + (mine ? ' mine' : '')}>
              <Avatar user={u} size={26} />
              <div className="bubble">
                <div className="bubble-head">
                  <b>{mine ? 'Вы' : u?.first_name}</b>
                  <span className="muted">{fmtDue(c.created_at)}</span>
                  {mine && (
                    <button className="x small" aria-label="Удалить комментарий" onClick={() => onDeleteComment(c.id)}>
                      ✕
                    </button>
                  )}
                </div>
                <div className="bubble-text">{c.text}</div>
              </div>
            </div>
          );
        })}
        <div className="comment-form">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Написать комментарий…"
          />
          <button className="send" onClick={send} disabled={!text.trim() || sending} aria-label="Отправить">
            ➤
          </button>
        </div>
      </div>

      <div className="actions">
        <button className="primary" onClick={onToggle}>
          {done ? '↩ Вернуть в новые' : '✓ Отметить выполненной'}
        </button>
        <button className="secondary" onClick={onEdit}>Изменить</button>
        <button className="danger" onClick={confirmDelete}>Удалить</button>
      </div>
    </div>
  );
}
