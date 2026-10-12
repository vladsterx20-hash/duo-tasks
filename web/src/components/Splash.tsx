/** Экран загрузки: круг рисуется по окружности, затем появляется галочка и название */
export function Splash({ leaving }: { leaving: boolean }) {
  return (
    <div className={'splash' + (leaving ? ' out' : '')} role="status" aria-label="Загрузка">
      <div className="splash-logo">
        <svg className="splash-icon" viewBox="0 0 96 96" width="84" height="84" aria-hidden="true">
          <rect className="splash-tile" x="0" y="0" width="96" height="96" rx="26" fill="var(--accent)" />
          <circle
            className="splash-ring"
            cx="48"
            cy="48"
            r="23"
            fill="none"
            stroke="#111111"
            strokeWidth="5.5"
            strokeLinecap="round"
            transform="rotate(-90 48 48)"
          />
          <path
            className="splash-check"
            d="M37 49.5 L45 57.5 L60 40"
            fill="none"
            stroke="#111111"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="splash-text">
          <span>Трекер</span> <b>задач</b>
        </div>
      </div>
    </div>
  );
}
