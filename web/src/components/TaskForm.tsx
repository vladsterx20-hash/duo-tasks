import { useEffect, useMemo, useRef, useState } from 'react';
import WebApp from '@twa-dev/sdk';
import { api } from '../api';
import { PRIORITY_LABEL } from '../types';
import type { AssigneeChoice, Attachment, Priority, Task, User } from '../types';
import { cleanMoney, fmtMoney, fmtSize, haptic, inTelegram, toLocalInput, toNum } from '../utils';
import { AddressField, type AddressValue } from './AddressField';
import { Icon } from './Icon';
import { MapPicker } from './MapPicker';
import { PickerField } from './PickerField';

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
  const initialDue = toLocalInput(task?.due_at ?? null);
  const [title, setTitle] = useState(task?.title ?? '');
  const [customer, setCustomer] = useState(task?.customer ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [date, setDate] = useState(initialDue.slice(0, 10));
  const [time, setTime] = useState(initialDue.slice(11, 16));
  const [addr, setAddr] = useState<AddressValue>({
    address: task?.address ?? '',
    lat: task?.lat ?? null,
    lng: task?.lng ?? null,
  });
  const [picker, setPicker] = useState(false);
  const [assignee, setAssignee] = useState<AssigneeChoice>(initialChoice(task, me));
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'normal');
  const [price, setPrice] = useState(task && task.price ? String(task.price) : '');
  const [cost, setCost] = useState(task && task.cost ? String(task.cost) : '');
  const [files, setFiles] = useState<File[]>([]);
  const [existing, setExisting] = useState<Attachment[]>(task?.attachments ?? []);
  const [removed, setRemoved] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // «Показать на карте»: открываем окно с картой. Если точка ещё не выбрана, но адрес введён — ищем его на карте.
  // Координаты сохраняются только после «Готово» в окне карты.
  const [mapInit, setMapInit] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  async function openMap() {
    if (addr.lat !== null && addr.lng !== null) {
      setMapInit({ lat: addr.lat, lng: addr.lng });
    } else {
      let found: { lat: number; lng: number } | null = null;
      const q = addr.address.trim();
      if (q.length >= 3) {
        setLocating(true);
        try {
          const r = await api.geocode(q);
          if (r[0]) found = { lat: r[0].lat, lng: r[0].lng };
        } catch {
          /* откроем карту без точки */
        } finally {
          setLocating(false);
        }
      }
      setMapInit(found);
    }
    setPicker(true);
  }

  const profit = Math.round((toNum(price) - toNum(cost)) * 100) / 100;

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
    if (!title.trim()) return setError('Введите название');
    setBusy(true);
    setError('');
    if (inTelegram()) WebApp.MainButton.showProgress();
    try {
      const fd = new FormData();
      fd.set('title', title.trim());
      fd.set('customer', customer.trim());
      fd.set('description', description);
      // Если указана дата без времени — берём 18:00
      fd.set('due_at', date ? new Date(`${date}T${time || '18:00'}`).toISOString() : '');
      fd.set('assignee', assignee);
      fd.set('priority', priority);
      fd.set('price', String(toNum(price)));
      fd.set('cost', String(toNum(cost)));
      fd.set('address', addr.address.trim());
      fd.set('lat', addr.lat === null ? '' : String(addr.lat));
      fd.set('lng', addr.lng === null ? '' : String(addr.lng));
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
    mb.color = '#FF5A00';
    mb.textColor = '#111111';
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
    <div className="form">
      <label className="field-label" htmlFor="f-title">Название</label>
      <input
        id="f-title"
        className="field"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Название задачи"
        maxLength={200}
        autoFocus={!task}
      />

      <label className="field-label" htmlFor="f-customer">Заказчик</label>
      <input
        id="f-customer"
        className="field"
        value={customer}
        onChange={(e) => setCustomer(e.target.value)}
        placeholder="Название заказчика"
        maxLength={200}
        autoComplete="off"
      />

      <label className="field-label" htmlFor="f-desc">Описание</label>
      <textarea id="f-desc" className="field" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Описание" />

      <div className="two-cols">
        <div>
          <span className="field-label">Срок</span>
          <PickerField type="date" value={date} onChange={setDate} label="Срок: дата" placeholder="Выберите дату" />
        </div>
        <div>
          <span className="field-label">Время</span>
          <PickerField type="time" value={time} onChange={setTime} label="Срок: время" placeholder="Выберите время" />
        </div>
      </div>

      <label className="field-label">Исполнитель</label>
      <div className="seg-pill small">
        {choices.map(([k, name]) => (
          <button key={k} type="button" className={assignee === k ? 'active' : ''} onClick={() => setAssignee(k)}>
            {name}
          </button>
        ))}
      </div>

      <label className="field-label">Приоритет</label>
      <div className="seg-pill small">
        {(['low', 'normal', 'high'] as Priority[]).map((p) => (
          <button key={p} type="button" className={priority === p ? 'active' : ''} onClick={() => setPriority(p)}>
            {p === 'high' ? '🔥 ' : ''}
            {PRIORITY_LABEL[p]}
          </button>
        ))}
      </div>

      <label className="field-label">Адрес</label>
      <AddressField value={addr} onChange={setAddr} onShowOnMap={openMap} mapBusy={locating} />

      <label className="field-label">Файлы (до 20 МБ каждый)</label>
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
              <Icon name="x" size={16} />
            </button>
          </div>
        ))}
        {files.map((f, i) => (
          <div className="file-item" key={i}>
            {previews[i] ? <img src={previews[i]!} alt="" /> : <span className="file-icon">📄</span>}
            <span className="file-name">{f.name}</span>
            <span className="muted">{fmtSize(f.size)}</span>
            <button type="button" className="x" aria-label="Убрать файл" onClick={() => setFiles(files.filter((_, j) => j !== i))}>
              <Icon name="x" size={16} />
            </button>
          </div>
        ))}
        <label className="field add-file">
          + Прикрепить
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

      <div className="two-cols">
        <div>
          <label className="field-label" htmlFor="f-price">Стоимость, ₽</label>
          <input id="f-price" className="field" inputMode="decimal" value={price} onChange={(e) => setPrice(cleanMoney(e.target.value))} placeholder="Для клиента" />
        </div>
        <div>
          <label className="field-label" htmlFor="f-cost">Себестоимость, ₽</label>
          <input id="f-cost" className="field" inputMode="decimal" value={cost} onChange={(e) => setCost(cleanMoney(e.target.value))} placeholder="Затраты" />
        </div>
      </div>
      <div className="profit-row">
        <b>Прибыль</b>
        <b className={'profit-val' + (profit < 0 ? ' neg' : '')}>{price || cost ? fmtMoney(profit) : '[авто] ₽'}</b>
      </div>

      {error && <div className="error" role="alert">{error}</div>}
      {!inTelegram() && (
        <button className="primary" onClick={submit} disabled={busy}>
          {busy ? 'Сохранение…' : task ? 'Сохранить' : 'Создать'}
        </button>
      )}

      {picker && (
        <MapPicker
          initial={mapInit}
          onCancel={() => setPicker(false)}
          onDone={(v) => {
            setAddr({ address: addr.address.trim() ? addr.address : v.address, lat: v.lat, lng: v.lng });
            setPicker(false);
          }}
        />
      )}
    </div>
  );
}
