import { useEffect, type ReactNode } from 'react';

interface Props {
  onClose: () => void;
  children: ReactNode;
}

/** Нижнее окно поверх экрана */
export function Sheet({ onClose, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheet-back" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        {children}
      </div>
    </div>
  );
}
