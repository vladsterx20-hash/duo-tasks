import { useCallback, useEffect, useState } from 'react';
import WebApp from '@twa-dev/sdk';
import { api, ApiError } from './api';
import type { AppNotification, Settings, Status, Task, User } from './types';
import { applyTheme } from './theme';
import { haptic, inTelegram } from './utils';
import { BottomNav, type Tab } from './components/BottomNav';
import { BellButton, TopBar } from './components/TopBar';
import { Home } from './components/Home';
import { TasksScreen } from './components/TasksScreen';
import { TaskForm } from './components/TaskForm';
import { TaskDetail } from './components/TaskDetail';
import { MapScreen } from './components/MapScreen';
import { ChatScreen } from './components/ChatScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { NotificationsScreen } from './components/NotificationsScreen';
import { CompleteSheet } from './components/CompleteSheet';

type Overlay = null | { name: 'form'; taskId?: number } | { name: 'detail'; taskId: number } | { name: 'notifications' };

const TITLES: Record<Tab, string> = { home: 'Главная', tasks: 'Задачи', map: '', chat: 'Чат', settings: 'Настройки' };
const SYNC_MS = 30_000;

export default function App() {
  const [me, setMe] = useState<User>();
  const [users, setUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<Settings>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<{ items: AppNotification[]; unread: number }>({ items: [], unread: 0 });
  const [tab, setTab] = useState<Tab>('home');
  const [taskTab, setTaskTab] = useState<Status>('new');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [completing, setCompleting] = useState<Task | null>(null);
  const [chatTaskId, setChatTaskId] = useState<number | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'denied' | 'error'>('loading');
  const [toast, setToast] = useState('');

  const showError = useCallback((e: unknown) => {
    setToast((e as Error).message || 'Ошибка');
    setTimeout(() => setToast(''), 3000);
  }, []);

  const load = useCallback(
    async (first = false) => {
      try {
        const [m, list, n] = await Promise.all([first ? api.me() : null, api.tasks(), api.notifications()]);
        if (m) {
          setMe(m.me);
          setUsers(m.users);
          setSettings(m.settings);
          applyTheme(m.settings.theme);
        }
        setTasks(list);
        setNotes(n);
        setState('ready');
      } catch (e) {
        if (e instanceof ApiError && (e.status === 403 || e.status === 401)) setState('denied');
        else if (first) setState('error');
        else showError(e);
      }
    },
    [showError]
  );

  // Обновление при открытии, при возврате в приложение и раз в 30 секунд (синхронизация между двумя пользователями)
  useEffect(() => {
    load(true);
    const onVis = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVis);
    const timer = setInterval(() => document.visibilityState === 'visible' && load(), SYNC_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      clearInterval(timer);
    };
  }, [load]);

  const upsert = (t: Task) =>
    setTasks((prev) => (prev.some((x) => x.id === t.id) ? prev.map((x) => (x.id === t.id ? t : x)) : [t, ...prev]));

  // Кнопка «Назад» Telegram
  const back = useCallback(() => {
    setOverlay((o) => (o?.name === 'form' && o.taskId ? { name: 'detail', taskId: o.taskId } : null));
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
    if (overlay) WebApp.BackButton.show();
    else WebApp.BackButton.hide();
  }, [overlay]);

  async function changeStatus(t: Task, status: Status, profit?: number) {
    const before = t;
    upsert({ ...t, status }); // оптимистично
    haptic(status === 'done' ? 'success' : 'light');
    try {
      upsert(await api.setStatus(t.id, status, profit));
    } catch (e) {
      upsert(before);
      showError(e);
      throw e;
    }
  }

  const take = (t: Task) => changeStatus(t, 'in_progress').catch(() => {});

  async function confirmComplete(profit: number) {
    if (!completing) return;
    try {
      await changeStatus(completing, 'done', profit);
      setCompleting(null);
    } catch {
      /* окно остаётся открытым, ошибка показана */
    }
  }

  async function remove(t: Task) {
    try {
      await api.remove(t.id);
      setTasks((p) => p.filter((x) => x.id !== t.id));
      setOverlay(null);
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

  function openNotifications() {
    setOverlay({ name: 'notifications' });
    if (notes.unread > 0) {
      api.readNotifications().catch(() => {});
      setNotes((n) => ({ ...n, unread: 0 })); // подсветка непрочитанных остаётся, пока список открыт
    }
  }

  if (state === 'loading')
    return (
      <div className="skeleton-screen" aria-busy="true" aria-label="Загрузка">
        <div className="skeleton bar-sk" />
        <div className="skeleton pill-sk" />
        <div className="skeleton hero-sk" />
        {[0, 1].map((i) => (
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
  if (state === 'error' || !me || !settings)
    return (
      <div className="center">
        <p>Не удалось загрузить данные</p>
        <button
          className="primary narrow"
          onClick={() => {
            setState('loading');
            load(true);
          }}
        >
          Повторить
        </button>
      </div>
    );

  const partner = users.find((u) => u.id !== me.id);
  const current = overlay && 'taskId' in overlay && overlay.taskId ? tasks.find((t) => t.id === overlay.taskId) : undefined;
  const refresh = () => load();

  const openTask = (t: Task) => setOverlay({ name: 'detail', taskId: t.id });

  // ----- содержимое -----
  let title = TITLES[tab];
  let content: React.ReactNode;
  let right: React.ReactNode;
  let fullBleed = false;

  if (overlay?.name === 'form') {
    title = current ? 'Редактирование' : 'Новая задача';
    content = (
      <TaskForm
        key={current?.id ?? 'new'}
        task={current}
        me={me}
        partner={partner}
        onSaved={(t) => {
          upsert(t);
          setOverlay({ name: 'detail', taskId: t.id });
        }}
      />
    );
  } else if (overlay?.name === 'detail' && current) {
    title = 'Задача';
    content = (
      <TaskDetail
        task={current}
        users={users}
        meId={me.id}
        onEdit={() => setOverlay({ name: 'form', taskId: current.id })}
        onDelete={() => remove(current)}
        onTake={() => take(current)}
        onComplete={() => setCompleting(current)}
        onReopen={() => changeStatus(current, 'in_progress').catch(() => {})}
        onComment={(text) => addComment(current, text)}
        onDeleteComment={(cid) => deleteComment(current, cid)}
      />
    );
  } else if (overlay?.name === 'notifications') {
    title = 'Уведомления';
    content = <NotificationsScreen items={notes.items} onOpenTask={(id) => setOverlay({ name: 'detail', taskId: id })} />;
  } else {
    if (tab === 'home') {
      right = <BellButton unread={notes.unread} onClick={openNotifications} />;
      content = (
        <Home
          tasks={tasks}
          users={users}
          onOpen={openTask}
          onTake={take}
          onComplete={setCompleting}
          onAll={() => setTab('tasks')}
          onRefresh={refresh}
        />
      );
    } else if (tab === 'tasks') {
      content = (
        <TasksScreen
          tasks={tasks}
          users={users}
          meId={me.id}
          tab={taskTab}
          onTab={setTaskTab}
          onOpen={openTask}
          onTake={take}
          onComplete={setCompleting}
          onNew={() => setOverlay({ name: 'form' })}
          onRefresh={refresh}
        />
      );
    } else if (tab === 'map') {
      fullBleed = true;
      content = <MapScreen tasks={tasks} onOpen={openTask} />;
    } else if (tab === 'chat') {
      content = (
        <ChatScreen
          tasks={tasks}
          users={users}
          meId={me.id}
          taskId={chatTaskId}
          onTaskId={setChatTaskId}
          onSend={(t, text) => addComment(t, text)}
        />
      );
    } else {
      content = <SettingsScreen settings={settings} onChange={setSettings} onError={showError} />;
    }
  }

  const showNav = !overlay;

  return (
    <div className={'app' + (fullBleed && !overlay ? ' bleed' : '')}>
      {!(fullBleed && !overlay) && (
        <TopBar title={title} onBack={overlay && !inTelegram() ? back : undefined} right={right} />
      )}
      <main className={'screen' + (fullBleed && !overlay ? ' screen-bleed' : '') + (overlay ? ' screen-overlay' : '')}>{content}</main>
      {showNav && <BottomNav tab={tab} onChange={setTab} />}
      {completing && <CompleteSheet task={completing} onConfirm={confirmComplete} onClose={() => setCompleting(null)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
