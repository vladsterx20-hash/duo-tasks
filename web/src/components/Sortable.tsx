import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { haptic } from '../utils';

const HOLD_MS = 380; // сколько держать палец, чтобы «взять» карточку
const CANCEL_PX = 10; // сдвинули палец раньше — это прокрутка, а не перетаскивание

interface Props<T> {
  items: T[];
  getId: (t: T) => number;
  render: (t: T) => ReactNode;
  /** новый порядок id после отпускания */
  onReorder: (ids: number[]) => void;
}

interface Drag {
  id: number;
  from: number;
  target: number;
  dy: number;
  /** высота шага: карточка + отступ */
  step: number;
}

interface Press {
  id: number;
  startX: number;
  startY: number;
  timer: number;
  active: boolean;
  centers: number[];
  from: number;
  step: number;
  target: number;
}

/** Список, в котором карточки можно переставлять: зажмите карточку и тяните вверх или вниз */
export function SortableList<T>({ items, getId, render, onReorder }: Props<T>) {
  const root = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const ids = items.map(getId);
  const idsRef = useRef(ids);
  idsRef.current = ids;
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;
  const press = useRef<Press | null>(null);
  const suppressClick = useRef(false);

  // Пока тянем — не даём странице прокручиваться и не пускаем жест к «потяни, чтобы обновить»
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const block = (e: TouchEvent) => {
      if (press.current?.active) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    el.addEventListener('touchmove', block, { passive: false });
    return () => el.removeEventListener('touchmove', block);
  }, []);

  // Обработчики живут в ref, чтобы их можно было снять с window по тем же ссылкам
  const handlers = useRef<{ move: (e: PointerEvent) => void; up: () => void; cancel: () => void }>({
    move: () => {},
    up: () => {},
    cancel: () => {},
  });

  function stop() {
    const st = press.current;
    if (st) window.clearTimeout(st.timer);
    press.current = null;
    window.removeEventListener('pointermove', handlers.current.move);
    window.removeEventListener('pointerup', handlers.current.up);
    window.removeEventListener('pointercancel', handlers.current.cancel);
    setDrag(null);
  }

  handlers.current.move = (e: PointerEvent) => {
    const st = press.current;
    if (!st) return;
    if (!st.active) {
      // палец ушёл до срабатывания удержания — отменяем (человек прокручивает страницу)
      if (Math.abs(e.clientY - st.startY) > CANCEL_PX || Math.abs(e.clientX - st.startX) > CANCEL_PX) stop();
      return;
    }
    const dy = e.clientY - st.startY;
    const center = st.centers[st.from] + dy;
    // позиция вставки = сколько остальных карточек выше центра перетаскиваемой
    let target = 0;
    st.centers.forEach((c, i) => {
      if (i !== st.from && c < center) target++;
    });
    st.target = target;
    setDrag({ id: st.id, from: st.from, target, dy, step: st.step });
  };

  handlers.current.up = () => {
    const st = press.current;
    if (st?.active) {
      suppressClick.current = true;
      window.setTimeout(() => (suppressClick.current = false), 350);
      if (st.target !== st.from) {
        const next = [...idsRef.current];
        const [moved] = next.splice(st.from, 1);
        next.splice(st.target, 0, moved);
        onReorderRef.current(next);
        haptic('success');
      }
    }
    stop();
  };

  handlers.current.cancel = () => stop();

  function onDown(e: RPointerEvent, id: number) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-nodrag]')) return;
    const nodes = Array.from(root.current?.querySelectorAll<HTMLElement>('[data-sid]') ?? []);
    const from = nodes.findIndex((n) => Number(n.dataset.sid) === id);
    if (from < 0) return;
    stop();
    const timer = window.setTimeout(() => {
      const st = press.current;
      if (!st) return;
      const rects = nodes.map((n) => n.getBoundingClientRect());
      st.centers = rects.map((r) => r.top + r.height / 2);
      const gap = rects[from + 1] ? rects[from + 1].top - rects[from].bottom : 12;
      st.step = rects[from].height + Math.max(gap, 0);
      st.active = true;
      haptic();
      setDrag({ id, from, target: from, dy: 0, step: st.step });
    }, HOLD_MS);
    press.current = { id, startX: e.clientX, startY: e.clientY, timer, active: false, centers: [], from, step: 0, target: from };
    window.addEventListener('pointermove', handlers.current.move);
    window.addEventListener('pointerup', handlers.current.up);
    window.addEventListener('pointercancel', handlers.current.cancel);
  }

  useEffect(() => () => stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={root} className="sortable">
      {items.map((it, i) => {
        const id = getId(it);
        let style: CSSProperties | undefined;
        let cls = 'sortable-item';
        if (drag) {
          if (id === drag.id) {
            cls += ' dragging';
            style = { transform: `translateY(${drag.dy}px) scale(1.02)`, transition: 'none' };
          } else if (drag.from < drag.target && i > drag.from && i <= drag.target) {
            style = { transform: `translateY(${-drag.step}px)` };
          } else if (drag.from > drag.target && i >= drag.target && i < drag.from) {
            style = { transform: `translateY(${drag.step}px)` };
          }
        }
        return (
          <div
            key={id}
            data-sid={id}
            className={cls}
            style={style}
            onPointerDown={(e) => onDown(e, id)}
            onContextMenu={(e) => e.preventDefault()}
            onClickCapture={(e) => {
              if (suppressClick.current) {
                e.stopPropagation();
                e.preventDefault();
              }
            }}
          >
            {render(it)}
          </div>
        );
      })}
    </div>
  );
}
