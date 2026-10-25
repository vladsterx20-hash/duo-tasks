import { useLayoutEffect, useRef } from 'react';

const MAX_H = 150; // дальше — прокрутка внутри поля

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
}

/** Поле сообщения: Enter переносит строку (отправка — только кнопкой), высота растёт вместе с текстом */
export function GrowInput({ value, onChange, placeholder, maxLength }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const border = el.offsetHeight - el.clientHeight; // рамка: scrollHeight её не включает
    const full = el.scrollHeight + border;
    el.style.height = Math.min(full, MAX_H) + 'px';
    el.style.overflowY = full > MAX_H ? 'auto' : 'hidden';
  }, [value]);
  return (
    <textarea
      ref={ref}
      className="field pill grow-input"
      rows={1}
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
