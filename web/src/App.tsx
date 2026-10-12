import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import WebApp from '@twa-dev/sdk';
import { api, ApiError } from './api';
import type { Task, User } from './types';
import { haptic, inTelegram } from './utils';
import { TaskCard } from './components/TaskCard';
import { TaskForm } from './components/TaskForm';
import { TaskDetail } from './components/TaskDetail';

type View = { name: 'list' } | { name: 'form'; taskId?: number } | { name: 'detail'; taskId: number };

const PULL = 70;

export default function App() {
  const [me, setMe] = useState<User>();
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tab, setTab] = useState<'new' | 'done'>('new');
  const [view, setView] = useState<View>({ name: 'list' });
  const [state, setState] = useState<'loading' | 'ready' | 'denied' | 'error'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [pull, setPull] = useState(0);
  const [toast, setToast] = useState('');

  const showError = (e: unknown) => {
    setToast((e as Error).message || 'Ошибка');
    setTimeout(() => setToast(''), 3000);
  };

  const load = useCallback(async (first = false) => {
    try {
      const [m, list] = await Promise.all([first ? api.me() : null, api.tasks()]);
      if (m) {
        setMe(m.me);
        setUsers(m.users);
      }
      setTasks(list);
      setState('ready');
    } catch (e) {
      if (e instanceof ApiError && (e.status === 403 || e.status === 401)) setState('denied');
      else if (first) setState('error');
      else showError(e);
    }
  }, []);

  useEffect(() => {
    load(true);
    const onVis = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [load]);

  const upsert = (t: Task) => setTasks((prev) => (prev.some((x) => x.id === t.id) ? prev.map((x) => (x.id === t.id ? t : x)) : [t, ...prev]));

  // Кнопка «Назад» Telegram
  const back = useCallback(() => {
    setView((v) => (v.name === 'form' && v.taskId ? { name: 'detail', taskId: v.taskId } : { name: 'list' }));
  }, []);
  useEffect(() => {
    if (!inTelegram()) return;
    const bb = WebApp.BackButton;
    bb.onClick(back);
    return () => {
      bb.offClick(back);
    };
  }, [back]);
  useEffect(() => {
    if (!inTelegram()) return;
    if (view.name === 'list') WebApp.BackButton.hide();
    else WebApp.BackButton.show();
  }, [view.name]);

  async function toggle(t: Task) {
    const next = t.status === 'done' ? 'new' : 'done';
    upsert({ ...t, status: next }); // оптимистично
    haptic(next === 'done' ? 'success' : 'light');
    try {
      upsert(await api.setStatus(t.id, next));
    } catch (e) {
      upsert(t);
      showError(e);
    }
  }

  async function remove(t: Task) {
    try {
      await api.remove(t.id);
      setTasks((p) => p.filter((x) => x.id !== t.id));
      setView({ name: 'list' });
    } catch (e) {
      showError(e);
    }
  }

  const visible = useMemo(() => {
    const list = tasks.filter((t) => t.status === tab);
    const due = (t: Task) => (t.due_at ? new Date(t.due_at).getTime() : Infinity);
    if (tab === 'new') return list.sort((a, b) => due(a) - due(b));
    return list.sort((a, b) => +new Date(b.completed_at ?? 0) - +new Date(a.completed_at ?? 0));
  }, [tasks, tab]);

  // Pull-to-refresh
  const ptr = useRef<{ y: number; x: number; active: boolean } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    ptr.current = { y: e.touches[0].clientY, x: e.touches[0].clientX, active: window.scrollY <= 0 };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const p = ptr.current;
    if (!p || !p.active || refreshing) return;
    const dy = e.touches[0].clientY - p.y;
    const dx = Math.abs(e.touches[0].clientX - p.x);
    if (dy > 0 && dy > dx) setPull(Math.min(dy * 0.5, 100));
  };
  const onTouchEnd = async () => {
    const triggered = pull >= PULL / 2 + 5;
    ptr.current = null;
    setPull(0);
    if (triggered) {
      setRefreshing(true);
      haptic();
      await load();
      setRefreshing(false);
    }
  };

  if (state === 'loading') return <div className="center muted">Загрузка…</div>;
  if (state === 'denied')
    return (
      <div className="center">
        <div className="lock">🔒</div>
        <h1>Доступ закрыт</h1>
        <p className="muted">Это приложение доступно только для двух участников.</p>
      </div>
    );
  if (state === 'error' || !me)
    return (
      <div className="center">
        <p>Не удалось загрузить данные</p>
        <button className="primary" onClick={() => { setState('loading'); load(true); }}>Повторить</button>
      </div>
    );

  const partner = users.find((u) => u.id !== me.id);
  const current = view.name !== 'list' && 'taskId' in view && view.taskId ? tasks.find((t) => t.id === view.taskId) : undefined;

  let content: React.ReactNode;
  if (view.name === 'form') {
    content = (
      <TaskForm
        task={current}
        me={me}
        partner={partner}
        onSaved={(t) => {
          upsert(t);
          setView({ name: 'detail', taskId: t.id });
        }}
      />
    );
  } else if (view.name === 'detail' && current) {
    content = (
      <TaskDetail
        task={current}
        users={users}
        onEdit={() => setView({ name: 'form', taskId: current.id })}
        onDelete={() => remove(current)}
        onToggle={() => toggle(current)}
      />
    );
  } else {
    const count = (s: 'new' | 'done') => tasks.filter((t) => t.status === s).length;
    content = (
      <div className="screen" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <div className="ptr" style={{ height: refreshing ? 36 : pull }}>
          {(refreshing || pull > 0) && <span className={refreshing ? 'spin' : ''}>{refreshing ? '⟳' : pull >= PULL / 2 + 5 ? 'Отпустите' : '↓'}</span>}
        </div>
        <div className="tabs">
          <button className={tab === 'new' ? 'active' : ''} onClick={() => setTab('new')}>
            Новые задачи <span className="badge">{count('new')}</span>
          </button>
          <button className={tab === 'done' ? 'active' : ''} onClick={() => setTab('done')}>
            Завершённые <span className="badge">{count('done')}</span>
          </button>
        </div>
        {visible.length === 0 ? (
          <div className="empty">{tab === 'new' ? 'Новых задач нет 🎉' : 'Пока ничего не завершено'}</div>
        ) : (
          visible.map((t) => (
            <TaskCard key={t.id} task={t} users={users} onOpen={() => setView({ name: 'detail', taskId: t.id })} onToggle={() => toggle(t)} />
          ))
        )}
        <button className="fab" aria-label="Новая задача" onClick={() => setView({ name: 'form' })}>＋</button>
      </div>
    );
  }

  return (
    <>
      {view.name !== 'list' && !inTelegram() && (
        <button className="back" onClick={back}>← Назад</button>
      )}
      {content}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
