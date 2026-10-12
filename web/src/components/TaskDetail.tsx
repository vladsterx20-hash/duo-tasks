import WebApp from '@twa-dev/sdk';
import type { Task, User } from '../types';
import { assigneesOf, fmtDue, fmtSize, inTelegram, isOverdue, openFile } from '../utils';
import { Avatar } from './Avatar';

interface Props {
  task: Task;
  users: User[];
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}

export function TaskDetail({ task, users, onEdit, onDelete, onToggle }: Props) {
  const author = users.find((u) => u.id === task.author_id);
  const done = task.status === 'done';

  function confirmDelete() {
    if (inTelegram()) WebApp.showConfirm('Удалить задачу безвозвратно?', (ok) => ok && onDelete());
    else if (confirm('Удалить задачу безвозвратно?')) onDelete();
  }

  return (
    <div className="screen detail">
      <h1 className={done ? 'struck' : ''}>{task.title}</h1>

      <div className={'chip' + (isOverdue(task) ? ' overdue' : '')}>🕒 {fmtDue(task.due_at)}</div>

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
