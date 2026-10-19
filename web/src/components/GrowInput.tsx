import { useLayoutEffect, useRef } from 'react';

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
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
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
