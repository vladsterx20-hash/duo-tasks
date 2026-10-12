import { haptic } from '../utils';
import { Icon, type IconName } from './Icon';

export type Tab = 'home' | 'tasks' | 'map' | 'chat' | 'settings';

const ITEMS: { tab: Tab; icon: IconName; label: string }[] = [
  { tab: 'home', icon: 'home', label: 'Главная' },
  { tab: 'tasks', icon: 'tasks', label: 'Задачи' },
  { tab: 'map', icon: 'map', label: 'Карта' },
  { tab: 'chat', icon: 'chat', label: 'Чат' },
  { tab: 'settings', icon: 'sun', label: 'Настройки' },
];

export function BottomNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="nav" aria-label="Основное меню">
      {ITEMS.map((i) => (
        <button
          key={i.tab}
          className={'nav-btn' + (tab === i.tab ? ' active' : '')}
          aria-label={i.label}
          aria-current={tab === i.tab ? 'page' : undefined}
          onClick={() => {
            if (tab !== i.tab) haptic();
            onChange(i.tab);
          }}
        >
          <Icon name={i.icon} size={20} />
          {tab === i.tab && <span>{i.label}</span>}
        </button>
      ))}
    </nav>
  );
}
