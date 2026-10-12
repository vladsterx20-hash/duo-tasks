import { useState } from 'react';
import { PRIORITY_LABEL } from '../types';
import type { Task, User } from '../types';
import { assigneesOf, fmtDue, fmtMoney, fmtSize, isOverdue, openFile, statusLabel } from '../utils';
import { Avatar } from './Avatar';
import { Icon } from './Icon';

interface Props {
  task: Task;
  users: User[];
  meId: number;
  onComment: (text: string) => Promise<void>;
  onDeleteComment: (id: number) => void;
}

/** Действия с задачей (маршрут, статус, изменить, удалить) вынесены в меню «⋯» в правом верхнем углу */
export function TaskDetail({ task, users, meId, onComment, onDeleteComment }: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const executors = assigneesOf(task, users);

  async function send() {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await onComment(text.trim());
      setText('');
    } catch {
      /* ошибка показана в App */
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="detail">
      <h2 className={'detail-title' + (task.status === 'done' ? ' struck' : '')}>
        <span className="pin-num">{task.id}</span> {task.title}
      </h2>

      <div className="chips">
        <span className={'chip status-' + task.status}>{statusLabel[task.status]}</span>
        <span className={'chip' + (isOverdue(task) ? ' overdue' : '')}>🕒 {fmtDue(task.due_at)}</span>
        <span className={'chip' + (task.priority === 'high' ? ' hot' : '')}>
          {task.priority === 'high' ? '🔥 ' : ''}Приоритет: {PRIORITY_LABEL[task.priority].toLowerCase()}
        </span>
      </div>

      {/* Только исполнители: один — рядом с подписью, двое — друг под другом */}
      <div className="assignees">
        <span className="muted">{executors.length > 1 ? 'Исполнители' : 'Исполнитель'}</span>
        <div className="assignees-list">
          {executors.map((u) => (
            <span key={u.id} className="person">
              <Avatar user={u} size={28} /> {u.first_name}
            </span>
          ))}
        </div>
      </div>

      {task.customer && (
        <div className="info-card">
          <div className="money-row">
            <span className="muted">Заказчик</span>
            <b className="customer-name">{task.customer}</b>
          </div>
        </div>
      )}

      {task.description && <p className="desc">{task.description}</p>}

      {(task.address || task.lat !== null) && (
        <div className="info-card">
          <div className="info-row">
            <Icon name="map" size={18} />
            <span>{task.address || 'Точка на карте'}</span>
          </div>
        </div>
      )}

      {(task.price > 0 || task.cost > 0 || task.profit !== null) && (
        <div className="info-card money">
          <div className="money-row"><span className="muted">Стоимость</span><b>{fmtMoney(task.price)}</b></div>
          <div className="money-row"><span className="muted">Себестоимость</span><b>{fmtMoney(task.cost)}</b></div>
          <div className="money-row">
            <span className="muted">{task.status === 'done' ? 'Прибыль (итог)' : 'Прибыль (план)'}</span>
            <b className="orange">{fmtMoney(task.status === 'done' && task.profit !== null ? task.profit : task.price - task.cost)}</b>
          </div>
        </div>
      )}

      {task.attachments.length > 0 && (
        <>
          <h3>Файлы</h3>
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

      <h3>Комментарии{task.comments.length > 0 ? ` · ${task.comments.length}` : ''}</h3>
      <div className="comments">
        {task.comments.length === 0 && <div className="muted">Пока нет комментариев</div>}
        {task.comments.map((c) => {
          const mine = c.author_id === meId;
          const u = users.find((x) => x.id === c.author_id);
          return (
            <div key={c.id} className={'bubble' + (mine ? ' mine' : '')}>
              {!mine && <div className="bubble-name">{u?.first_name}</div>}
              <div className="bubble-text">{c.text}</div>
              <div className="bubble-time">
                {fmtDue(c.created_at)}
                {mine && (
                  <button className="bubble-del" aria-label="Удалить комментарий" onClick={() => onDeleteComment(c.id)}>
                    удалить
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div className="comment-form">
          <input
            className="field pill"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            maxLength={2000}
            placeholder="Комментарий…"
          />
          <button className="round-btn orange" onClick={send} disabled={!text.trim() || sending} aria-label="Отправить">
            <Icon name="send" size={18} strokeWidth={3} />
          </button>
        </div>
      </div>
    </div>
  );
}
