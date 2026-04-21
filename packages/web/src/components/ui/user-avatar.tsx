import { cn } from '@/lib/utils';

interface UserAvatarProps {
  firstName?: string | null;
  lastName?: string | null;
  email?: string;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

const SIZES: Record<NonNullable<UserAvatarProps['size']>, string> = {
  xs: 'h-5 w-5 text-[10px]',
  sm: 'h-6 w-6 text-[11px]',
  md: 'h-8 w-8 text-xs',
};

// Deterministic pastel background from a string.
function palette(seed: string) {
  const colors = [
    'bg-sky-100 text-sky-800',
    'bg-emerald-100 text-emerald-800',
    'bg-amber-100 text-amber-800',
    'bg-indigo-100 text-indigo-800',
    'bg-rose-100 text-rose-800',
    'bg-teal-100 text-teal-800',
    'bg-violet-100 text-violet-800',
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return colors[Math.abs(hash) % colors.length];
}

export function UserAvatar({
  firstName,
  lastName,
  email,
  size = 'sm',
  className,
}: UserAvatarProps) {
  const initials =
    `${firstName?.charAt(0) ?? ''}${lastName?.charAt(0) ?? ''}`.toUpperCase() ||
    email?.charAt(0).toUpperCase() ||
    '?';
  const tone = palette(`${firstName ?? ''}${lastName ?? ''}${email ?? ''}`);
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        SIZES[size],
        tone,
        className,
      )}
      aria-hidden
    >
      {initials}
    </span>
  );
}
