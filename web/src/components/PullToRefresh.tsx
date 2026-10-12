import { useRef, useState, type ReactNode } from 'react';
import { haptic } from '../utils';

const TRIGGER = 40;

export function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<void>; children: ReactNode }) {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const start = useRef<{ x: number; y: number; active: boolean } | null>(null);

  return (
    <div
      onTouchStart={(e) => {
        start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, active: window.scrollY <= 0 };
      }}
      onTouchMove={(e) => {
        const s = start.current;
        if (!s || !s.active || busy) return;
        const dy = e.touches[0].clientY - s.y;
        const dx = Math.abs(e.touches[0].clientX - s.x);
        if (dy > 0 && dy > dx) setPull(Math.min(dy * 0.5, 90));
      }}
      onTouchEnd={async () => {
        const go = pull >= TRIGGER;
        start.current = null;
        setPull(0);
        if (go) {
          setBusy(true);
          haptic();
          try {
            await onRefresh();
          } finally {
            setBusy(false);
          }
        }
      }}
    >
      <div className="ptr" style={{ height: busy ? 36 : pull }}>
        {(busy || pull > 0) && <span className={busy ? 'spin' : ''}>{busy ? '⟳' : pull >= TRIGGER ? 'Отпустите' : '↓'}</span>}
      </div>
      {children}
    </div>
  );
}
