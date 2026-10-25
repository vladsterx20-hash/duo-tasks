import { useCallback, useEffect, useRef, useState } from 'react';
import WebApp from '@twa-dev/sdk';
import { api, ApiError } from './api';
import type { ActiveTab, AppNotification, Period, HomeOrder, ReserveEntry, Settings, Status, Task, User } from './types';
import { applyAccent, applyTheme } from './theme';
import { handleBack } from './backStack';
import { DISPLAY_NAMES, haptic, inTelegram, openRoute, periodFrom, reserveBalance } from './utils';
import { CompletedList } from './components/CompletedList';
import { ActionMenu, type MenuItem } from './components/ActionMenu';
import { BottomNav, type Tab } from './components/BottomNav';
import { AddButton, BellButton, MoreButton, TopBar } from './components/TopBar';
import { Home } from './components/Home';
import { TasksScreen } from './components/TasksScreen';
import { TaskForm } from './components/TaskForm';
import { TaskDetail } from './components/TaskDetail';
import { MapScreen } from './components/MapScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { NotificationsScreen } from './components/NotificationsScreen';
import { CompleteSheet, type CompleteValues } from './components/CompleteSheet';
import { FundScreen, ProfitScreen, ReserveScreen } from './components/Fund';
import { ReserveSheet } from './components/ReserveSheet';
import { Splash } from './components/Splash';
import { About } from './components/About';

type Overlay =
  | null
  | { name: 'form'; taskId?: number }
  | { name: 'detail'; taskId: number }
  | { name: 'notifications' }
  | { name: 'done' }
  | { name: 'fund' }
  | { name: 'reserve' }
  | { name: 'profit' };

const TITLES: Record<Tab, string> = { home: 'Главная', tasks: 'Задачи', map: '', settings: 'Настройки' };
const SYNC_MS = 30_000;
const TAB_ORDER: Tab[] = ['home', 'tasks', 'settings'];

const SPLASH_MIN_MS = 3600; // анимация идёт ~2,6 с, затем логотип и лозунг держатся около секунды
const SPLASH_MIN_REDUCED_MS = 600; // если в системе включено «уменьшить движение»
const SPLASH_FADE_MS = 450;

/** Экран загрузки поверх приложения при каждом открытии: уходит, когда данные готовы и анимация доиграла */
export default function App() {
  const [ready, setReady] = useState(false);
  const [minDone, setMinDone] = useState(false);
  const [phase, setPhase] = useState<'show' | 'leave' | 'gone'>('show');

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(() => setMinDone(true), reduced ? SPLASH_MIN_REDUCED_MS : SPLASH_MIN_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!(ready && minDone)) return;
    setPhase('leave');
    const t = setTimeout(() => setPhase('gone'), SPLASH_FADE_MS);
    return () => clearTimeout(t);
  }, [ready, minDone]);

  const onReady = useCallback(() => setReady(true), []);

  return (
    <>
      <AppInner onReady={onReady} />
      {phase !== 'gone' && <Splash leaving={phase === 'leave'} />}
    </>
  );
}

function AppInner({ onReady }: { onReady: () => void }) {
  const [me, setMe] = useState<User>();
  const [users, setUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<Settings>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<{ items: AppNotification[]; unread: number }>({ items: [], unread: 0 });
  const [tab, setTab] = useState<Tab>('home');
  // Направление последней смены раздела — для анимации «въезда» страницы
  const [slide, setSlide] = useState<'' | 'from-right' | 'from-left'>('');
  const goTab = useCallback((next: Tab) => {
    setTab((cur) => {
      const idx = (t: Tab) => TAB_ORDER.indexOf(t === 'map' ? 'tasks' : t);
      if (idx(next) !== idx(cur)) setSlide(idx(next) > idx(cur) ? 'from-right' : 'from-left');
      return next;
    });
  }, []);
  const [taskTab, setTaskTab] = useState<ActiveTab>('new');
  const [period, setPeriod] = useState<Period>('month');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [completing, setCompleting] = useState<Task | null>(null);
  const [reserve, setReserve] = useState<ReserveEntry[]>([]);
  const [homeOrder, setHomeOrder] = useState<HomeOrder>({ pinned: [], upcoming: [] });
  const [quickId, setQuickId] = useState<number | null>(null); // задача, для которой открыто быстрое меню (по номеру)
  const [pins, setPins] = useState<number[]>([]); // закреплённые на главной задачи (у каждого свои)
  const [reserveOp, setReserveOp] = useState<null | 'add' | 'withdraw'>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [state, setState] = useState<'loading' | 'ready' | 'denied' | 'error'>('loading');
  const [toast, setToast] = useState('');

  // Данные загружены (или доступ закрыт / ошибка) — можно убирать экран загрузки
  useEffect(() => {
    if (state !== 'loading') onReady();
  }, [state, onReady]);

  const showError = useCallback((e: unknown) => {
    setToast((e as Error).message || 'Ошибка');
    setTimeout(() => setToast(''), 3000);
  }, []);

  const load = useCallback(
    async (first = false) => {
      try {
        const [m, list, n, res, pn, ho] = await Promise.all([first ? api.me() : null, api.tasks(), api.notifications(), api.reserve(), api.pins(), api.homeOrder()]);
        if (m) {
          setMe(m.me);
          setUsers(m.users);
          setSettings(m.settings);
          applyTheme(m.settings.theme);
          applyAccent(m.settings.accent);
        }
        setTasks(list);
        setNotes(n);
        setReserve(res);
        setPins(pn);
        setHomeOrder(ho);
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
    if (handleBack()) return; // открыт просмотрщик файла — «Назад» закрывает только его
    setOverlay((o) =>
      o?.name === 'form' && o.taskId ? { name: 'detail', taskId: o.taskId } : o?.name === 'reserve' || o?.name === 'profit' ? { name: 'fund' } : null
    );
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

  // Свайп влево-вправо переключает разделы: Главная → Задачи → Чат → Настройки
  const swipeBlocked = !!overlay || aboutOpen || !!reserveOp || !!completing || menuOpen || tab === 'map';
  useEffect(() => {
    if (swipeBlocked) return;
    const ORDER = TAB_ORDER;
    let start: { x: number; y: number; t: number } | null = null;
    // Не перехватываем жесты внутри полей ввода и областей, которые сами прокручиваются вбок
    const ignored = (el: EventTarget | null) => {
      let n = el as HTMLElement | null;
      while (n && n !== document.body) {
        if (n.matches?.('input, textarea, select, .leaflet-container, .modal, .sheet, .viewer')) return true;
        if (n.scrollWidth > n.clientWidth + 2 && /(auto|scroll)/.test(getComputedStyle(n).overflowX)) return true;
        n = n.parentElement;
      }
      return false;
    };
    const onStart = (e: TouchEvent) => {
      const p = e.touches[0];
      start = e.touches.length === 1 && !ignored(e.target) ? { x: p.clientX, y: p.clientY, t: Date.now() } : null;
    };
    const onEnd = (e: TouchEvent) => {
      if (!start) return;
      const p = e.changedTouches[0];
      const dx = p.clientX - start.x;
      const dy = p.clientY - start.y;
      const dt = Math.max(Date.now() - start.t, 1);
      start = null;
      // Достаточно короткого быстрого «броска» или небольшого протягивания пальцем
      const enough = Math.abs(dx) >= 40 || (Math.abs(dx) >= 22 && Math.abs(dx) / dt > 0.35);
      if (!enough || dt > 900 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
      const i = ORDER.indexOf(tab);
      const next = ORDER[i + (dx < 0 ? 1 : -1)];
      if (next) {
        haptic();
        goTab(next);
        window.scrollTo(0, 0);
      }
    };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchend', onEnd);
    };
  }, [swipeBlocked, tab, goTab]);

  async function changeStatus(t: Task, status: Status, extra?: { profit?: number; price?: number; cost?: number }) {
    const before = t;
    // оптимистично
    upsert({
      ...t,
      status,
      ...(extra?.price !== undefined ? { price: extra.price } : {}),
      ...(extra?.cost !== undefined ? { cost: extra.cost } : {}),
      ...(status === 'done' ? { profit: extra?.profit ?? t.price - t.cost, completed_at: new Date().toISOString() } : {}),
    });
    haptic(status === 'done' ? 'success' : 'light');
    try {
      upsert(await api.setStatus(t.id, status, extra));
    } catch (e) {
      upsert(before);
      showError(e);
      throw e;
    }
  }

  const take = (t: Task) => changeStatus(t, 'in_progress').catch(() => {});

  async function confirmComplete(v: CompleteValues) {
    if (!completing) return;
    try {
      await changeStatus(completing, 'done', v);
      setCompleting(null);
    } catch {
      /* окно остаётся открытым, ошибка показана */
    }
  }

  // Завершённые задачи за выбранный на главной период, новые сверху
  const balance = reserveBalance(tasks, reserve);

  async function reserveOperation(kind: 'add' | 'withdraw', amount: number, note: string) {
    const list = await api.addReserve(kind, amount, note); // ошибку (например, «недостаточно средств») показывает окно
    setReserve(list);
    setReserveOp(null);
    haptic('success');
  }

  async function deleteReserveEntry(id: number) {
    try {
      setReserve(await api.deleteReserve(id));
    } catch (e) {
      showError(e);
    }
  }

  const doneSince = (p: Period) => {
    const from = periodFrom(p);
    return tasks
      .filter((t) => t.status === 'done' && t.completed_at && new Date(t.completed_at).getTime() >= from)
      .sort((a, b) => +new Date(b.completed_at!) - +new Date(a.completed_at!));
  };

  async function remove(t: Task) {
    try {
      await api.remove(t.id);
      setTasks((p) => p.filter((x) => x.id !== t.id));
      setOverlay(null);
    } catch (e) {
      showError(e);
    }
  }

  async function uploadFiles(t: Task, files: File[]) {
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));
    try {
      upsert(await api.addFiles(t.id, fd));
      haptic('success');
    } catch (e) {
      showError(e);
      throw e;
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
    title = `Задача №${current.id}`;
    right = <MoreButton onClick={() => setMenuOpen(true)} expanded={menuOpen} />;
    content = (
      <TaskDetail
        task={current}
        users={users}
        meId={me.id}
        onComment={(text) => addComment(current, text)}
        onDeleteComment={(cid) => deleteComment(current, cid)}
        onUpload={(files) => uploadFiles(current, files)}
      />
    );
  } else if (overlay?.name === 'done') {
    title = 'Сделанные задачи';
    content = <CompletedList tasks={doneSince('all')} users={users} period="all" showProfit={false} onOpen={openTask} />;
  } else if (overlay?.name === 'fund') {
    title = 'Фонд компании';
    content = (
      <FundScreen
        doneAll={doneSince('all')}
        balance={balance}
        onOpenProfit={() => setOverlay({ name: 'profit' })}
        onOpenReserve={() => setOverlay({ name: 'reserve' })}
      />
    );
  } else if (overlay?.name === 'profit') {
    title = 'Прибыль с заказов';
    content = <ProfitScreen tasks={doneSince(period)} period={period} onPeriod={setPeriod} onOpen={openTask} />;
  } else if (overlay?.name === 'reserve') {
    title = 'Общий резерв';
    content = (
      <ReserveScreen
        doneAll={doneSince('all')}
        entries={reserve}
        users={users}
        meId={me.id}
        balance={balance}
        onOpen={openTask}
        onOperation={() => setReserveOp('add')}
        onDeleteEntry={deleteReserveEntry}
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
          meName={DISPLAY_NAMES[me.id] ?? me.first_name}
          pins={pins}
          order={homeOrder}
          onReorder={reorderHome}
          onNumber={(t) => setQuickId(t.id)}
          onOpen={openTask}
          onTake={take}
          onAll={() => setTab('tasks')}
          onNew={() => setOverlay({ name: 'form' })}
          onOpenDone={() => setOverlay({ name: 'done' })}
          onOpenFund={() => setOverlay({ name: 'fund' })}
          onRefresh={refresh}
        />
      );
    } else if (tab === 'tasks') {
      right = <AddButton onClick={() => setOverlay({ name: 'form' })} />;
      content = (
        <TasksScreen
          tasks={tasks}
          users={users}
          meId={me.id}
          tab={taskTab}
          onTab={setTaskTab}
          onOpen={openTask}
          onTake={take}
          onMap={() => setTab('map')}
          onRefresh={refresh}
        />
      );
    } else if (tab === 'map') {
      fullBleed = true;
      content = <MapScreen tasks={tasks} tab={taskTab} onTab={setTaskTab} onList={() => setTab('tasks')} onOpen={openTask} />;
    } else {
      content = <SettingsScreen settings={settings} onChange={setSettings} onError={showError} />;
    }
  }

  // Меню действий: маршрут → статус → изменить → удалить
  async function reorderHome(section: keyof HomeOrder, ids: number[]) {
    setHomeOrder((cur) => ({ ...cur, [section]: ids })); // сразу на экране, сервер догоняет
    try {
      setHomeOrder(await api.setHomeOrder(section, ids));
    } catch (e) {
      showError(e);
    }
  }

  async function togglePin(t: Task) {
    const pinned = !pins.includes(t.id);
    setPins((cur) => (pinned ? [t.id, ...cur] : cur.filter((x) => x !== t.id))); // сразу, без ожидания сервера
    haptic();
    try {
      setPins(await api.setPin(t.id, pinned));
    } catch (e) {
      setPins((cur) => (pinned ? cur.filter((x) => x !== t.id) : [t.id, ...cur]));
      showError(e);
    }
  }

  function taskMenu(t: Task): MenuItem[] {
    const items: MenuItem[] = [];
    if (t.status !== 'done')
      items.push({
        label: pins.includes(t.id) ? 'Открепить с главной' : 'Закрепить на главной',
        icon: 'pin',
        onClick: () => togglePin(t),
      });
    if (t.lat !== null && t.lng !== null) items.push({ label: 'Маршрут', icon: 'route', onClick: () => openRoute(t.lat!, t.lng!) });
    if (t.status === 'new') items.push({ label: 'Взять в работу', icon: 'play', onClick: () => take(t) });
    if (t.status === 'in_progress') {
      items.push({ label: 'Завершить задачу', icon: 'check', onClick: () => setCompleting(t) });
      items.push({ label: 'Вернуть в новое', icon: 'undo', onClick: () => changeStatus(t, 'new').catch(() => {}) });
    }
    if (t.status === 'done') items.push({ label: 'Вернуть в работу', icon: 'undo', onClick: () => changeStatus(t, 'in_progress').catch(() => {}) });
    items.push({ label: 'Изменить', icon: 'edit', onClick: () => setOverlay({ name: 'form', taskId: t.id }) });
    items.push({ label: 'Удалить', icon: 'trash', danger: true, onClick: () => confirmDelete(t) });
    return items;
  }

  function confirmDelete(t: Task) {
    const q = 'Удалить задачу безвозвратно?';
    if (inTelegram()) WebApp.showConfirm(q, (ok) => ok && remove(t));
    else if (confirm(q)) remove(t);
  }

  const showNav = !overlay;

  return (
    <div className={'app' + (fullBleed && !overlay ? ' bleed' : '')}>
      {!(fullBleed && !overlay) && (
        <TopBar
          title={title}
          onBack={overlay ? back : undefined}
          right={right}
          stacked={!!overlay}
          logo={!overlay && (tab === 'home' || tab === 'tasks' || tab === 'settings')}
          onLogo={tab === 'home' ? () => { haptic(); setAboutOpen(true); } : undefined}
        />
      )}
      <main
        key={overlay ? 'overlay' : tab}
        className={'screen' + (fullBleed && !overlay ? ' screen-bleed' : '') + (overlay ? ' screen-overlay' : '') + (!overlay && slide ? ' slide-' + slide : '')}
      >{content}</main>
      {showNav && <BottomNav tab={tab} onChange={goTab} />}
      {quickId !== null && tasks.some((x) => x.id === quickId) && (
        <ActionMenu items={taskMenu(tasks.find((x) => x.id === quickId)!)} onClose={() => setQuickId(null)} />
      )}
      {menuOpen && overlay?.name === 'detail' && current && <ActionMenu items={taskMenu(current)} onClose={() => setMenuOpen(false)} />}
      {aboutOpen && <About onClose={() => setAboutOpen(false)} />}
      {reserveOp && <ReserveSheet balance={balance} initial={reserveOp} onSubmit={reserveOperation} onClose={() => setReserveOp(null)} />}
      {completing && <CompleteSheet task={completing} users={users} onConfirm={confirmComplete} onClose={() => setCompleting(null)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
