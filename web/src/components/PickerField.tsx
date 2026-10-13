import { Icon } from './Icon';

interface Props {
  type: 'date' | 'time';
  value: string; // 'YYYY-MM-DD' или 'HH:MM'
  onChange: (v: string) => void;
  label: string; // для скринридеров
  placeholder: string;
}

/** «18 окт. 2026» — коротко, чтобы две колонки (срок и время) не растягивались */
function fmtDate(v: string): string {
  const d = new Date(`${v}T00:00`);
  return `${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} ${d.getFullYear()}`;
}

const fmt = (type: 'date' | 'time', v: string) => (type === 'time' ? v : fmtDate(v));

/**
 * Видимое поле выбора даты/времени. Сам <input> прозрачный и лежит поверх поля, поэтому нажатие в любом месте
 * открывает системный выбор. (Пустые нативные date/time на iPhone схлопываются и выглядят невидимыми.)
 */
export function PickerField({ type, value, onChange, label, placeholder }: Props) {
  return (
    <div className="field picker-field">
      <span className={'pf-text' + (value ? '' : ' empty')}>{value ? fmt(type, value) : placeholder}</span>
      <Icon name={type === 'date' ? 'calendar' : 'clock'} size={18} />
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
          <Icon name="x" size={16} />
        </button>
      )}
    </div>
  );
}
