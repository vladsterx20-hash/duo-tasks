import type { User } from '../types';

export function Avatar({ user, size = 24 }: { user?: User; size?: number }) {
  const style = { width: size, height: size, fontSize: size * 0.45 };
  if (user?.photo_url) return <img className="avatar" style={style} src={user.photo_url} alt={user.first_name} />;
  return (
    <span className="avatar avatar-fallback" style={style}>
      {(user?.first_name || '?').slice(0, 1).toUpperCase()}
    </span>
  );
}

export function AvatarStack({ users, size }: { users: User[]; size?: number }) {
  return (
    <span className="avatar-stack">
      {users.map((u) => (
        <Avatar key={u.id} user={u} size={size} />
      ))}
    </span>
  );
}
