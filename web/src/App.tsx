import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import WebApp from '@twa-dev/sdk';
import { api, ApiError } from './api';
import { PRIORITY_WEIGHT } from './types';
import type { Settings, Task, User } from './types';
import { SettingsScreen } from './components/SettingsScreen';
import { haptic, inTelegram } from './utils';
import { TaskCard } from './components/TaskCard';
import { TaskForm } from './components/TaskForm';
import { TaskDetail } from './components/TaskDetail';

type View = { name: 'list' } | { name: 'settings' } | { name: 'form'; taskId?: number } | { name: 'detail'; taskId: number };

const PULL = 70;

export default function App() {
  const [me, setMe] = useState<User>();
  const [users, setUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<Settings>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tab, setTab] = useState<'new' | 'done'>('new');
  const [who, setWho] = useState<'all' | 'me' | 'partner'>('all');
  const [onlyHigh, setOnlyHigh] = useState(false);
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
        setSettings(m.settings);
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

  async function addComment(t: Task, text: string) {
    try {
      upsert(await api.addComment(t.id, text));
      haptic();
    } catch (e) {
      showError(e);
      throw e;
    }
  }

  async function deleteComment(t: Task, cid: number) {
    try {
      upsert(await api.deleteComment(t.id, cid));
    } catch (e) {
      showError(e);
    }
  }

  const filtered = useMemo(() => {
    const myId = me?.id;
    return tasks.filter((t) => {
      if (onlyHigh && t.priority !== 'high') return false;
      if (who === 'me') return t.assignee_id === null || t.assignee_id === myId;
      if (who === 'partner') return t.assignee_id === null || t.assignee_id !== myId;
      return true;
    });
  }, [tasks, who, onlyHigh, me]);

  const visible = useMemo(() => {
    const list = filtered.filter((t) => t.status === tab);
    const due = (t: Task) => (t.due_at ? new Date(t.due_at).getTime() : Infinity);
    if (tab === 'new')
      return list.sort((a, b) => due(a) - due(b) || PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]);
    return list.sort((a, b) => +new Date(b.completed_at ?? 0) - +new Date(a.completed_at ?? 0));
  }, [filtered, tab]);

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

  if (state === 'loading')
    return (
      <div className="screen" aria-busy="true" aria-label="Загрузка">
        <div className="skeleton topbar-sk" />
        <div className="skeleton tabs-sk" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton card-sk" style={{ animationDelay: `${i * 0.12}s` }} />
        ))}
      </div>
    );
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
  if (view.name === 'settings' && settings) {
    content = <SettingsScreen settings={settings} onChange={setSettings} onError={showError} />;
  } else if (view.name === 'form') {
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
        meId={me.id}
        onComment={(text) => addComment(current, text)}
        onDeleteComment={(cid) => deleteComment(current, cid)}
        onEdit={() => setView({ name: 'form', taskId: current.id })}
        onDelete={() => remove(current)}
        onToggle={() => toggle(current)}
      />
    );
  } else {
    const count = (s: 'new' | 'done') => filtered.filter((t) => t.status === s).length;
    const filterActive = who !== 'all' || onlyHigh;
    content = (
      <div className="screen" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <div className="ptr" style={{ height: refreshing ? 36 : pull }}>
          {(refreshing || pull > 0) && <span className={refreshing ? 'spin' : ''}>{refreshing ? '⟳' : pull >= PULL / 2 + 5 ? 'Отпустите' : '↓'}</span>}
        </div>
        <header className="topbar">
          <div>
            <div className="hello">Привет, {me.first_name} 👋</div>
            <div className="muted">
              {tasks.filter((t) => t.status === 'new').length === 0
                ? 'Все задачи выполнены'
                : `Активных задач: ${tasks.filter((t) => t.status === 'new').length}`}
            </div>
          </div>
          <button className="icon-btn" aria-label="Настройки уведомлений" onClick={() => setView({ name: 'settings' })}>
            🔔
          </button>
        </header>
        <div className="tabs">
          <button className={tab === 'new' ? 'active' : ''} onClick={() => setTab('new')}>
            Новые задачи <span className="badge">{count('new')}</span>
          </button>
          <button className={tab === 'done' ? 'active' : ''} onClick={() => setTab('done')}>
            Завершённые <span className="badge">{count('done')}</span>
          </button>
        </div>
        <div className="filters">
          {([['all', 'Все'], ['me', 'Мои'], ['partner', partner?.first_name ?? 'Партнёр']] as const).map(([k, label]) => (
            <button key={k} className={'fchip' + (who === k ? ' active' : '')} onClick={() => setWho(k)}>
              {label}
            </button>
          ))}
          <button className={'fchip' + (onlyHigh ? ' active' : '')} onClick={() => setOnlyHigh(!onlyHigh)}>
            🔥 Важные
          </button>
        </div>
        {visible.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">{filterActive ? '🔎' : tab === 'new' ? '🎉' : '📭'}</div>
            <div className="empty-title">
              {filterActive ? 'Ничего не найдено' : tab === 'new' ? 'Новых задач нет' : 'Пока ничего не завершено'}
            </div>
            <div className="muted">
              {filterActive
                ? 'Попробуйте сменить фильтр'
                : tab === 'new'
                  ? 'Нажмите «＋», чтобы добавить задачу'
                  : 'Выполненные задачи появятся здесь'}
            </div>
          </div>
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
