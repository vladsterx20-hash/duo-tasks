import type { User } from '../types';

type Tone = 'orange' | 'white';

export function Avatar({ user, size = 24, tone = 'orange' }: { user?: User; size?: number; tone?: Tone }) {
  const style = { width: size, height: size, fontSize: size * 0.42 };
  if (user?.photo_url) return <img className="avatar" style={style} src={user.photo_url} alt={user.first_name} title={user.first_name} />;
  return (
    <span className={'avatar avatar-fallback tone-' + tone} style={style} title={user?.first_name}>
      {(user?.first_name || '?').slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Исполнители в ряд: первый оранжевый, второй белый (как в макете) */
export function AvatarStack({ users, size }: { users: User[]; size?: number }) {
  return (
    <span className="avatar-stack" aria-label={users.map((u) => u.first_name).join(', ')}>
      {users.map((u, i) => (
        <Avatar key={u.id} user={u} size={size} tone={i === 0 ? 'orange' : 'white'} />
      ))}
    </span>
  );
}
