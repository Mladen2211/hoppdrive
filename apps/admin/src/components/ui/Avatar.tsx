/**
 * Avatar: round initials badge (decorative; the name is always next to it).
 *
 *   <Avatar name="Mladen R." />                       -> "MR" on anthracite
 *   <Avatar initials="?" tone="gray" size="sm" />
 *
 * Props: name (initials = first letters of the first two words), initials (explicit override),
 *   size: 'sm' (28) | 'md' (38, default) | 'lg' (44), tone: 'ink' (default) | 'ruby' | 'blue' |
 *   'green' | 'vio' | 'amber' | 'gray', className.
 */
import { cn } from './cn';

const TONE_CLASS = {
  ink: 'bg-ink text-on-ink',
  ruby: 'bg-ruby text-white',
  blue: 'bg-info text-on-fill',
  green: 'bg-ok text-on-fill',
  vio: 'bg-vio text-on-fill',
  amber: 'bg-warn text-on-fill',
  gray: 'bg-graphite text-on-ink',
} as const;

const SIZE_CLASS = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-[38px] w-[38px] text-[15px]',
  lg: 'h-11 w-11 text-base',
} as const;

export function initialsOf(name: string | undefined | null): string {
  if (!name) return '';
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const first = words[0][0] ?? '';
  const second = words.length > 1 ? (words[words.length - 1][0] ?? '') : '';
  return (first + second).toUpperCase();
}

export interface AvatarProps {
  name?: string | null;
  initials?: string;
  size?: keyof typeof SIZE_CLASS;
  tone?: keyof typeof TONE_CLASS;
  className?: string;
}

export function Avatar({ name, initials, size = 'md', tone = 'ink', className }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex flex-none select-none items-center justify-center rounded-full font-bold',
        TONE_CLASS[tone],
        SIZE_CLASS[size],
        className,
      )}
    >
      {initials ?? (initialsOf(name) || '?')}
    </span>
  );
}
