import { useState } from 'react';
import { PRIORITY_LABEL } from '../types';
import type { Task, User } from '../types';
import { assigneesOf, fileKind, fmtDue, fmtMoney, fmtSize, isOverdue, openFile, statusLabel } from '../utils';
import { FileViewer } from './FileViewer';
import { AvatarStack } from './Avatar';
import { GrowInput } from './GrowInput';
import { Icon, type IconName } from './Icon';

interface Props {
  task: Task;
  users: User[];
  meId: number;
  onComment: (text: string) => Promise<void>;
  onDeleteComment: (id: number) => void;
  onUpload: (files: File[]) => Promise<void>;
}

const MAX_FILE = 20 * 1024 * 1024;

function Row({ icon, label, children, alert }: { icon: IconName; label: string; children: React.ReactNode; alert?: boolean }) {
  return (
    <div className="drow">
      <Icon name={icon} size={18} />
      <span className="drow-label">{label}</span>
      <span className={'drow-value' + (alert ? ' alert' : '')}>{children}</span>
    </div>
  );
}

/** Действия с задачей (маршрут, статус, изменить, удалить) — в меню «⋯» справа вверху */
export function TaskDetail({ task, users, meId, onComment, onDeleteComment, onUpload }: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const executors = assigneesOf(task, users);
  const viewable = task.attachments.filter((a) => fileKind(a) !== 'other');
  const [viewIdx, setViewIdx] = useState<number | null>(null);

  // Скрепка рядом с комментарием: фото и файлы прикрепляются к задаче
  async function pick(list: FileList | null) {
    if (!list || list.length === 0) return;
    const files = Array.from(list);
    const tooBig = files.find((f) => f.size > MAX_FILE);
    if (tooBig) return setUploadError(`«${tooBig.name}» больше 20 МБ`);
    setUploadError('');
    setUploading(true);
    try {
      await onUpload(files);
    } catch {
      /* ошибка показана в App */
    } finally {
      setUploading(false);
    }
  }

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

  const planProfit = task.status === 'done' && task.profit !== null ? task.profit : task.price - task.cost;
  const hasMoney = task.price > 0 || task.cost > 0 || task.profit !== null;

  return (
    <div className="detail">
      <section className="dcard">
        <div className="dlabel">Задача:</div>
        <div className="dvalue">{task.title}</div>
      </section>

      <section className="dcard">
        <div className="dlabel">Описание:</div>
        {task.description ? <div className="dvalue pre">{task.description}</div> : <div className="dvalue muted">Описание не добавлено</div>}
      </section>

      <section className="dcard rows">
        <Row icon="list" label="Статус">
          {statusLabel[task.status]}
        </Row>
        <Row icon="clock" label="Срок" alert={isOverdue(task)}>
          {fmtDue(task.due_at)}
        </Row>
        <Row icon="flag" label="Приоритет">
          {PRIORITY_LABEL[task.priority]}
        </Row>
        {task.customer && (
          <Row icon="user" label="Заказчик">
            {task.customer}
          </Row>
        )}
        <Row icon="users" label={executors.length > 1 ? 'Исполнители' : 'Исполнитель'}>
          <AvatarStack users={executors} size={34} />
        </Row>
        {hasMoney && (
          <>
            <Row icon="coin" label="Стоимость">{fmtMoney(task.price)}</Row>
            <Row icon="coin" label="Себестоимость">{fmtMoney(task.cost)}</Row>
            <Row icon="coin" label={task.status === 'done' ? 'Прибыль (итог)' : 'Прибыль (план)'}>
              <span className="orange">{fmtMoney(planProfit)}</span>
            </Row>
          </>
        )}
      </section>

      {task.attachments.length > 0 && (
        <section className="sec">
          <h3 className="caps">Файлы · {task.attachments.length}</h3>
          <div className="files">
            {task.attachments.map((a) => (
              <button
                key={a.id}
                className="file-item link"
                onClick={() => {
                  // фото и текст открываем прямо в приложении, остальное — во внешнем браузере
                  const i = viewable.findIndex((v) => v.id === a.id);
                  if (i >= 0) setViewIdx(i);
                  else openFile(a.file_url);
                }}
              >
                {a.file_type.startsWith('image/') ? <img src={a.file_url} alt="" /> : <span className="file-icon">📄</span>}
                <span className="file-name">{a.file_name}</span>
                <span className="muted">{fmtSize(a.size)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Комментарии — внизу страницы */}
      <section className="comments-section">
        <h3 className="caps">Комментарии{task.comments.length > 0 ? ` · ${task.comments.length}` : ''}</h3>
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
        </div>
        {uploading && <div className="muted hint">Загружаем файл…</div>}
        {uploadError && <div className="error" role="alert">{uploadError}</div>}
      </section>

      {/* У завершённой задачи поля ввода (скрепка, комментарий, отправка) не показываем */}
      {task.status !== 'done' && (
      <div className="cbar">
        <label className={'round-btn dark' + (uploading ? ' busy' : '')} aria-label="Прикрепить фото или файл">
          <Icon name="clip" size={20} />
          <input
            type="file"
            multiple
            hidden
            disabled={uploading}
            onChange={(e) => {
              pick(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
        <GrowInput value={text} onChange={setText} maxLength={2000} placeholder="Комментарий…" />
        <button className="round-btn orange" onClick={send} disabled={!text.trim() || sending} aria-label="Отправить">
          <Icon name="send" size={18} strokeWidth={3} />
        </button>
      </div>
      )}

      {viewIdx !== null && viewable[viewIdx] && (
        <FileViewer files={viewable} index={viewIdx} onIndex={setViewIdx} onClose={() => setViewIdx(null)} />
      )}
    </div>
  );
}
