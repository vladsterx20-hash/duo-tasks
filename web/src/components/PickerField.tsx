import { Icon } from './Icon';

interface Props {
  type: 'date' | 'time' | 'datetime-local';
  value: string; // 'YYYY-MM-DD', 'HH:MM' или 'YYYY-MM-DDTHH:MM'
  onChange: (v: string) => void;
  label: string; // для скринридеров
  placeholder: string;
}

/** «18 окт. 2026» — коротко */
function fmtDate(v: string): string {
  const d = new Date(`${v}T00:00`);
  return `${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} ${d.getFullYear()}`;
}

function fmt(type: Props['type'], v: string): string {
  if (type === 'time') return v;
  if (type === 'date') return fmtDate(v);
  const [d, t] = v.split('T');
  return t ? `${fmtDate(d)}, ${t}` : fmtDate(d);
}

/**
 * Видимое поле выбора даты и времени. Сам <input> прозрачный и лежит поверх поля, поэтому нажатие в любом месте
 * открывает системный выбор. (Пустые нативные поля на iPhone схлопываются и выглядят невидимыми.)
 */
export function PickerField({ type, value, onChange, label, placeholder }: Props) {
  return (
    <div className="field picker-field">
      <span className={'pf-text' + (value ? '' : ' pf-placeholder')}>{value ? fmt(type, value) : placeholder}</span>
      <Icon name={type === 'time' ? 'clock' : 'calendar'} size={18} />
      <input
        className="pf-input"
        type={type}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => {
          // На компьютере нажатие по полю само выбор не открывает — открываем явно
          try {
            (e.currentTarget as HTMLInputElement).showPicker?.();
          } catch {
            /* не поддерживается — сработает стандартное поведение */
          }
        }}
      />
      {value && (
        <button type="button" className="pf-clear" aria-label={`Очистить: ${label}`} onClick={() => onChange('')}>
          <Icon name="x" size={14} />
        </button>
      )}
    </div>
  );
}
