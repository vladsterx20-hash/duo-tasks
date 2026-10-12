/** Логотип приложения: тёмная плитка, оранжевое кольцо, белая галочка */
export function Logo({ size = 44 }: { size?: number }) {
  return (
    <svg className="logo" viewBox="0 0 96 96" width={size} height={size} role="img" aria-label="Трекер задач">
      <rect width="96" height="96" rx="26" fill="#1c1c1c" />
      <circle cx="48" cy="48" r="25" fill="none" stroke="#f26b1d" strokeWidth="7" />
      <path
        d="M37.3 48.9 L44.9 56.5 L59.8 40.1"
        fill="none"
        stroke="#ffffff"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
