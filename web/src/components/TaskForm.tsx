import { useEffect, useMemo, useRef, useState } from 'react';
import WebApp from '@twa-dev/sdk';
import { api } from '../api';
import { PRIORITY_LABEL } from '../types';
import type { AssigneeChoice, Attachment, Priority, Task, User } from '../types';
import { fmtSize, haptic, inTelegram, toLocalInput } from '../utils';

const MAX = 20 * 1024 * 1024;

interface Props {
  task?: Task;
  me: User;
  partner?: User;
  onSaved: (t: Task) => void;
}

function initialChoice(task: Task | undefined, me: User): AssigneeChoice {
  if (!task) return 'me';
  if (task.assignee_id === null) return 'both';
  return task.assignee_id === me.id ? 'me' : 'partner';
}

export function TaskForm({ task, me, partner, onSaved }: Props) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [due, setDue] = useState(toLocalInput(task?.due_at ?? null));
  const [assignee, setAssignee] = useState<AssigneeChoice>(initialChoice(task, me));
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'normal');
  const [files, setFiles] = useState<File[]>([]);
  const [existing, setExisting] = useState<Attachment[]>(task?.attachments ?? []);
  const [removed, setRemoved] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const previews = useMemo(
    () => files.map((f) => (f.type.startsWith('image/') ? URL.createObjectURL(f) : null)),
    [files]
  );
  useEffect(() => () => previews.forEach((p) => p && URL.revokeObjectURL(p)), [previews]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const ok: File[] = [];
    for (const f of Array.from(list)) {
      if (f.size > MAX) setError(`«${f.name}» больше 20 МБ`);
      else ok.push(f);
    }
    setFiles((prev) => [...prev, ...ok]);
  }

  async function submit() {
    if (busy) return;
    if (!title.trim()) return setError('Введите заголовок');
    setBusy(true);
    setError('');
    if (inTelegram()) WebApp.MainButton.showProgress();
    try {
      const fd = new FormData();
      fd.set('title', title.trim());
      fd.set('description', description);
      fd.set('due_at', due ? new Date(due).toISOString() : '');
      fd.set('assignee', assignee);
      fd.set('priority', priority);
      files.forEach((f) => fd.append('files', f));
      let saved: Task;
      if (task) {
        fd.set('removeIds', JSON.stringify(removed));
        saved = await api.update(task.id, fd);
      } else saved = await api.create(fd);
      haptic('success');
      onSaved(saved);
    } catch (e) {
      setError((e as Error).message);
      haptic();
    } finally {
      setBusy(false);
      if (inTelegram()) WebApp.MainButton.hideProgress();
    }
  }

  // MainButton Telegram вместо кнопки на странице
  const submitRef = useRef(submit);
  submitRef.current = submit;
  useEffect(() => {
    if (!inTelegram()) return;
    const mb = WebApp.MainButton;
    const handler = () => submitRef.current();
    mb.setText(task ? 'Сохранить' : 'Создать');
    mb.onClick(handler);
    mb.show();
    return () => {
      mb.offClick(handler);
      mb.hideProgress();
      mb.hide();
    };
  }, [task]);

  const choices: [AssigneeChoice, string][] = [
    ['me', 'Я'],
    ['partner', partner?.first_name ?? 'Партнёр'],
    ['both', 'Оба'],
  ];

  return (
    <div className="screen form">
      <h1>{task ? 'Редактирование' : 'Новая задача'}</h1>

      <label>Заголовок *</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Что нужно сделать?" maxLength={200} autoFocus={!task} />

      <label>Описание</label>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Подробности" />

      <label>Срок выполнения</label>
      <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />

      <label>Исполнитель</label>
      <div className="segmented">
        {choices.map(([k, name]) => (
          <button key={k} type="button" className={assignee === k ? 'active' : ''} onClick={() => setAssignee(k)}>
            {name}
          </button>
        ))}
      </div>

      <label>Приоритет</label>
      <div className="segmented">
        {(['low', 'normal', 'high'] as Priority[]).map((p) => (
          <button key={p} type="button" className={(priority === p ? 'active ' : '') + 'p-' + p} onClick={() => setPriority(p)}>
            {p === 'high' ? '🔥 ' : ''}
            {PRIORITY_LABEL[p]}
          </button>
        ))}
      </div>

      <label>Файлы (до 20 МБ каждый)</label>
      <div className="files">
        {existing.map((a) => (
          <div className="file-item" key={a.id}>
            {a.file_type.startsWith('image/') ? <img src={a.file_url} alt="" /> : <span className="file-icon">📄</span>}
            <span className="file-name">{a.file_name}</span>
            <span className="muted">{fmtSize(a.size)}</span>
            <button
              type="button"
              className="x"
              aria-label="Удалить файл"
              onClick={() => {
                setExisting(existing.filter((x) => x.id !== a.id));
                setRemoved([...removed, a.id]);
              }}
            >
              ✕
            </button>
          </div>
        ))}
        {files.map((f, i) => (
          <div className="file-item" key={i}>
            {previews[i] ? <img src={previews[i]!} alt="" /> : <span className="file-icon">📄</span>}
            <span className="file-name">{f.name}</span>
            <span className="muted">{fmtSize(f.size)}</span>
            <button type="button" className="x" aria-label="Убрать файл" onClick={() => setFiles(files.filter((_, j) => j !== i))}>
              ✕
            </button>
          </div>
        ))}
        <label className="add-file">
          ＋ Прикрепить файл
          <input
            type="file"
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
      </div>

      {error && <div className="error">{error}</div>}
      {!inTelegram() && (
        <button className="primary" onClick={submit} disabled={busy}>
          {busy ? 'Сохранение…' : task ? 'Сохранить' : 'Создать'}
        </button>
      )}
    </div>
  );
}
