import { useEffect } from 'react';
import { Icon, type IconName } from './Icon';

export interface MenuItem {
  label: string;
  icon: IconName;
  danger?: boolean;
  onClick: () => void;
}

/** Выпадающее меню в правом верхнем углу */
export function ActionMenu({ items, onClose }: { items: MenuItem[]; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="menu-back" onClick={onClose}>
      <div className="menu" role="menu" onClick={(e) => e.stopPropagation()}>
        {items.map((it) => (
          <button
            key={it.label}
            role="menuitem"
            className={'menu-item' + (it.danger ? ' menu-danger' : '')}
            onClick={() => {
              onClose();
              it.onClick();
            }}
          >
            <Icon name={it.icon} size={18} />
            {it.label}
          </button>
        ))}
      </div>
    </div>
  );
}
