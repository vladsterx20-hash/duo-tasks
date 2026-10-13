import { useEffect, useRef, useState } from 'react';
import type { Task, User } from '../types';
import { fmtDue } from '../utils';
import { Icon } from './Icon';

interface Props {
  task: Task;
  users: User[];
  meId: number;
  onSend: (text: string) => Promise<void>;
  onUpload: (files: File[]) => Promise<void>;
  onOpenTask: () => void;
}

const MAX_FILE = 20 * 1024 * 1024;

/** Обсуждение одной задачи: лента сообщений и строка ввода */
export function ChatConversation({ task, users, meId, onSend, onUpload, onOpenTask }: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState('');
  const feedEnd = useRef<HTMLDivElement>(null);

  // Прокручиваем к последнему сообщению при открытии и при новых сообщениях
  useEffect(() => {
    feedEnd.current?.scrollIntoView({ block: 'end' });
  }, [task.id, task.comments.length]);

  async function send() {
    const v = text.trim();
    if (!v || sending) return;
    setSending(true);
    try {
      await onSend(v);
      setText('');
    } catch {
      /* ошибка показана в App */
    } finally {
      setSending(false);
    }
  }

  async function attach(list: FileList | null) {
    if (!list || !list.length) return;
    const files = Array.from(list);
    const big = files.find((f) => f.size > MAX_FILE);
    if (big) return setNote(`«${big.name}» больше 20 МБ`);
    setNote('');
    setUploading(true);
    try {
      await onUpload(files);
      setNote('Файл прикреплён к задаче');
      setTimeout(() => setNote(''), 2500);
    } catch {
      /* ошибка показана в App */
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <div className="chat">
        <button className="chat-task" onClick={onOpenTask}>
          <span className="chat-task-text">
            <span className="dlabel">Задача №{task.id}</span>
            <b>{task.title}</b>
          </span>
          <span className="link-orange">Открыть</span>
        </button>

        <div className="chat-feed">
          {task.comments.length === 0 && (
            <div className="chat-empty">
              <Icon name="chat" size={30} />
              <div>
                Сообщений пока нет.
                <br />
                Напишите первым.
              </div>
            </div>
          )}
          {task.comments.map((c) => {
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
        {note && (
          <div className="muted center-text" role="status">
            {note}
          </div>
        )}
      </div>

      <div className="cbar">
        <label className={'round-btn dark' + (uploading ? ' busy' : '')} aria-label="Прикрепить фото или файл к задаче">
          <Icon name="clip" size={20} />
          <input
            type="file"
            multiple
            hidden
            disabled={uploading}
            onChange={(e) => {
              attach(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
        <input
          className="field pill"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Сообщение…"
          maxLength={2000}
          autoFocus
        />
        <button className="round-btn orange" aria-label="Отправить" onClick={send} disabled={!text.trim() || sending}>
          <Icon name="send" size={18} strokeWidth={3} />
        </button>
      </div>
    </>
  );
}
