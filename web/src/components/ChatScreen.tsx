import { useEffect, useMemo, useRef, useState } from 'react';
import type { Task, User } from '../types';
import { fmtDue } from '../utils';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

interface Props {
  tasks: Task[];
  users: User[];
  meId: number;
  taskId: number | null;
  onTaskId: (id: number) => void;
  onSend: (task: Task, text: string) => Promise<void>;
}

export function ChatScreen({ tasks, users, meId, taskId, onTaskId, onSend }: Props) {
  const [text, setText] = useState('');
  const [picking, setPicking] = useState(false);
  const [sending, setSending] = useState(false);
  const feedEnd = useRef<HTMLDivElement>(null);

  // Если задача ещё не выбрана — берём ту, где последний комментарий, иначе самую свежую
  const task = useMemo(() => {
    const byId = tasks.find((t) => t.id === taskId);
    if (byId) return byId;
    const withComments = tasks
      .filter((t) => t.comments.length)
      .sort((a, b) => b.comments[b.comments.length - 1].id - a.comments[a.comments.length - 1].id);
    return withComments[0] ?? [...tasks].sort((a, b) => b.id - a.id)[0];
  }, [tasks, taskId]);

  useEffect(() => {
    feedEnd.current?.scrollIntoView({ block: 'end' });
  }, [task?.id, task?.comments.length]);

  async function send() {
    const v = text.trim();
    if (!v || !task || sending) return;
    setSending(true);
    try {
      await onSend(task, v);
      setText('');
    } catch {
      /* ошибка показана в App */
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="chat">
        <button className="chat-task" onClick={() => setPicking(true)} disabled={tasks.length === 0}>
          <span className="ellipsis">К задаче: {task ? task.title : 'нет задач'}</span>
          <span className="link-orange">Сменить</span>
        </button>

        <div className="chat-feed">
          {!task && <div className="muted center-text">Создайте задачу, чтобы писать комментарии</div>}
          {task && task.comments.length === 0 && <div className="muted center-text">Комментариев пока нет. Напишите первым.</div>}
          {task?.comments.map((c) => {
            const mine = c.author_id === meId;
            const u = users.find((x) => x.id === c.author_id);
            return (
              <div key={c.id} className={'bubble' + (mine ? ' mine' : '')}>
                {!mine && <div className="bubble-name">{u?.first_name}</div>}
                <div className="bubble-text">{c.text}</div>
                <div className="bubble-time">{fmtDue(c.created_at)}</div>
              </div>
            );
          })}
          <div ref={feedEnd} />
        </div>
      </div>

      <div className="chat-input">
        <button className="round-btn dark" aria-label="Выбрать задачу" onClick={() => setPicking(true)} disabled={tasks.length === 0}>
          <Icon name="plus" size={18} strokeWidth={3} />
        </button>
        <input
          className="field pill"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Комментарий…"
          maxLength={2000}
          disabled={!task}
        />
        <button className="round-btn orange" aria-label="Отправить" onClick={send} disabled={!text.trim() || sending || !task}>
          <Icon name="send" size={18} strokeWidth={3} />
        </button>
      </div>

      {picking && (
        <Sheet onClose={() => setPicking(false)}>
          <div className="sheet-title">К какой задаче?</div>
          <div className="pick-list">
            {[...tasks]
              .sort((a, b) => b.id - a.id)
              .map((t) => (
                <button
                  key={t.id}
                  className={'pick-item' + (t.id === task?.id ? ' active' : '')}
                  onClick={() => {
                    onTaskId(t.id);
                    setPicking(false);
                  }}
                >
                  <b className="ellipsis">{t.title}</b>
                  <span className="muted">{t.comments.length ? `💬 ${t.comments.length}` : 'без комментариев'}</span>
                </button>
              ))}
          </div>
        </Sheet>
      )}
    </>
  );
}
