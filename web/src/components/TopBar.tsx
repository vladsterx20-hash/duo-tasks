import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { Logo } from './Logo';

interface Props {
  title: string;
  /** Круглая кнопка «назад» слева */
  onBack?: () => void;
  /** Кнопка справа (колокольчик, «+», «⋯») */
  right?: ReactNode;
  /** Вложенные экраны: сначала ряд кнопок, ниже по центру заголовок */
  stacked?: boolean;
  /** Логотип в левом углу (когда нет кнопки «назад») */
  logo?: boolean;
  /** Если задано — логотип становится кнопкой */
  onLogo?: () => void;
}

export function TopBar({ title, onBack, right, stacked, logo, onLogo }: Props) {
  const left = onBack ? (
    <button className="round-btn dark" onClick={onBack} aria-label="Назад">
      <Icon name="back" size={20} />
    </button>
  ) : logo && onLogo ? (
    <button className="logo-btn" onClick={onLogo} aria-label="О приложении">
      <Logo />
    </button>
  ) : logo ? (
    <Logo />
  ) : (
    <span className="slot" />
  );
  const end = right ?? <span className="slot" />;

  if (stacked)
    return (
      <header className="topbar stacked">
        <div className="topbar-row">
          {left}
          {end}
        </div>
        <h1>{title}</h1>
      </header>
    );

  return (
    <header className="topbar">
      <div className="topbar-row">
        {left}
        <h1>{title}</h1>
        {end}
      </div>
    </header>
  );
}

export function BellButton({ unread, onClick }: { unread: number; onClick: () => void }) {
  return (
    <button className="round-btn dark bell" onClick={onClick} aria-label={unread ? `Уведомления: новых ${unread}` : 'Уведомления'}>
      <Icon name="bell" size={20} />
      {unread > 0 && <span className="bell-dot" />}
    </button>
  );
}

export function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="round-btn orange" onClick={onClick} aria-label="Новая задача">
      <Icon name="plus" size={22} strokeWidth={2.8} />
    </button>
  );
}

export function MoreButton({ onClick, expanded }: { onClick: () => void; expanded: boolean }) {
  return (
    <button className="round-btn dark" onClick={onClick} aria-label="Действия с задачей" aria-haspopup="menu" aria-expanded={expanded}>
      <Icon name="more" size={22} />
    </button>
  );
}
