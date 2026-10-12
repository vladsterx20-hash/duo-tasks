import type { ReactNode } from 'react';
import { Icon } from './Icon';

interface Props {
  title: string;
  /** Показывать стрелку «назад» (вне Telegram, где нет системной кнопки) */
  onBack?: () => void;
  right?: ReactNode;
}

export function TopBar({ title, onBack, right }: Props) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        {onBack && (
          <button className="topbar-back" onClick={onBack} aria-label="Назад">
            <Icon name="back" size={20} />
          </button>
        )}
        <h1>{title}</h1>
      </div>
      {right}
    </header>
  );
}

export function BellButton({ unread, onClick }: { unread: number; onClick: () => void }) {
  return (
    <button className="bell" onClick={onClick} aria-label={unread ? `Уведомления: новых ${unread}` : 'Уведомления'}>
      <Icon name="bell" size={20} />
      {unread > 0 && <span className="bell-dot" />}
    </button>
  );
}
