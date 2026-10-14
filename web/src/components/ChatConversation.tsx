import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Attachment, Task, User } from '../types';
import { fileKind, fmtSize, openFile } from '../utils';
import { FileViewer } from './FileViewer';
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
const NEAR_BOTTOM = 80; // px: ближе этого к низу считаем, что читатель «внизу ленты»

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

/** Подпись дня над сообщениями: «Сегодня», «Вчера» или дата */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.round(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() -
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) /
      86_400_000
  );
  if (diff === 0) return 'Сегодня';
  if (diff === 1) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) });
}

/**
 * Обсуждение одной задачи. Карточка задачи и строка ввода закреплены, а сообщения лежат в отдельной рамке
 * со своей прокруткой: длинный чат листается внутри неё.
 */
export function ChatConversation({ task, users, meId, onSend, onUpload, onOpenTask }: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState('');
  const [atBottom, setAtBottom] = useState(true);
  const panel = useRef<HTMLDivElement>(null);
  const stick = useRef(true); // пока читатель внизу ленты, новые сообщения прокручивают её сами
  // Все фото и тексты из этого чата — для просмотрщика с листанием
  const viewable = task.chat.flatMap((c) => c.attachments ?? []).filter((a) => fileKind(a) !== 'other');
  const [viewIdx, setViewIdx] = useState<number | null>(null);

  function openAttachment(a: Attachment) {
    const i = viewable.findIndex((v) => v.id === a.id);
    if (i >= 0) setViewIdx(i);
    else openFile(a.file_url);
  }

  // Плавно — только на небольшое расстояние; через всю длинную историю прыгаем сразу
  const scrollDown = (smooth: boolean) => {
    const el = panel.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth && distance < el.clientHeight * 2 ? 'smooth' : 'auto' });
  };

  // Открыли чат — сразу к последнему сообщению
  useLayoutEffect(() => {
    stick.current = true;
    scrollDown(false);
  }, [task.id]);

  // Пришло новое сообщение: если читатель внизу — прокручиваем, иначе показываем кнопку «вниз»
  useEffect(() => {
    if (stick.current) scrollDown(true);
  }, [task.chat.length]);

  // Картинка загрузилась и подняла высоту ленты — держимся внизу, если читатель там
  const onMediaLoad = () => {
    if (stick.current) scrollDown(false);
  };

  function onScroll() {
    const el = panel.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM;
    stick.current = near;
    setAtBottom(near);
  }

  // На телефоне клавиатура сжимает экран: подгоняем высоту чата под видимую область, чтобы ввод не прятался
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const set = () => document.documentElement.style.setProperty('--vvh', `${vv.height}px`);
    set();
    vv.addEventListener('resize', set);
    vv.addEventListener('scroll', set);
    return () => {
      vv.removeEventListener('resize', set);
      vv.removeEventListener('scroll', set);
      document.documentElement.style.removeProperty('--vvh');
    };
  }, []);

  async function send() {
    const v = text.trim();
    if (!v || sending) return;
    setSending(true);
    stick.current = true; // своё сообщение всегда показываем
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
      stick.current = true; // свой файл показываем сразу
      await onUpload(files);
    } catch {
      /* ошибка показана в App */
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="convo">
      <button className="chat-task" onClick={onOpenTask}>
        <span className="chat-task-text">
          <span className="dlabel">Задача №{task.id}</span>
          <b className="ellipsis">{task.title}</b>
        </span>
        <span className="link-orange">Открыть</span>
      </button>

      <div className="chat-panel-wrap">
        <div className="chat-panel" ref={panel} onScroll={onScroll} role="log" aria-label="Переписка по задаче">
          {task.chat.length === 0 && (
            <div className="chat-empty">
              <Icon name="chat" size={30} />
              <div>
                Сообщений пока нет.
                <br />
                Напишите первым.
              </div>
            </div>
          )}
          {task.chat.map((c, i) => {
            const mine = c.author_id === meId;
            const u = users.find((x) => x.id === c.author_id);
            const newDay = i === 0 || new Date(task.chat[i - 1].created_at).toDateString() !== new Date(c.created_at).toDateString();
            return (
              <Fragment key={c.id}>
                {newDay && <div className="day-chip">{dayLabel(c.created_at)}</div>}
                <div className={'bubble' + (mine ? ' mine' : '')}>
                  {!mine && <div className="bubble-name">{u?.first_name}</div>}
                  {c.attachments?.map((a) =>
                    a.file_type.startsWith('image/') ? (
                      <button key={a.id} className="bubble-photo" onClick={() => openAttachment(a)} aria-label={`Фото ${a.file_name}`}>
                        <img src={a.file_url} alt={a.file_name} onLoad={onMediaLoad} />
                      </button>
                    ) : (
                      <button key={a.id} className="bubble-file" onClick={() => openAttachment(a)}>
                        <span className="file-icon">📄</span>
                        <span className="bubble-file-name">
                          <b className="ellipsis">{a.file_name}</b>
                          <span>{fmtSize(a.size)}</span>
                        </span>
                      </button>
                    )
                  )}
                  {c.text && <div className="bubble-text">{c.text}</div>}
                  <div className="bubble-time">{timeOf(c.created_at)}</div>
                </div>
              </Fragment>
            );
          })}
        </div>
        {!atBottom && (
          <button className="to-bottom" aria-label="К последним сообщениям" onClick={() => scrollDown(true)}>
            <Icon name="chevron" size={20} strokeWidth={3} />
          </button>
        )}
      </div>

      {note && (
        <div className="muted center-text convo-note" role="status">
          {note}
        </div>
      )}

      {viewIdx !== null && viewable[viewIdx] && (
        <FileViewer files={viewable} index={viewIdx} onIndex={setViewIdx} onClose={() => setViewIdx(null)} />
      )}

      <div className="cbar inline">
        <label className={'round-btn dark' + (uploading ? ' busy' : '')} aria-label="Отправить фото или файл в чат">
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
        />
        <button className="round-btn orange" aria-label="Отправить" onClick={send} disabled={!text.trim() || sending}>
          <Icon name="send" size={18} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}
