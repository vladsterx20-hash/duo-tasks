import { haptic } from '../utils';
import { Icon, type IconName } from './Icon';

export type Tab = 'home' | 'tasks' | 'map' | 'settings';

const ITEMS: { tab: Tab; icon: IconName; label: string }[] = [
  { tab: 'home', icon: 'home', label: 'Главная' },
  { tab: 'tasks', icon: 'tasks', label: 'Задачи' },
  { tab: 'settings', icon: 'sun', label: 'Настройки' },
];

/** Карта открывается кнопкой «На карте» в задачах, поэтому, пока она открыта, подсвечиваем «Задачи» */
export function BottomNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const active: Tab = tab === 'map' ? 'tasks' : tab;
  return (
    <nav className="nav" aria-label="Основное меню">
      {ITEMS.map((i) => (
        <button
          key={i.tab}
          className={'nav-btn' + (active === i.tab ? ' active' : '')}
          aria-label={i.label}
          aria-current={active === i.tab ? 'page' : undefined}
          onClick={() => {
            if (tab !== i.tab) haptic();
            onChange(i.tab);
          }}
        >
          <Icon name={i.icon} size={20} />
          {active === i.tab && <span>{i.label}</span>}
        </button>
      ))}
    </nav>
  );
}
