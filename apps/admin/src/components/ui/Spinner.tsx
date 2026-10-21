import { cn } from './cn';

/**
 * Inline loading ring. Uses `currentColor`, so it matches the surrounding
 * text (white on a ruby button, ink on an outlined one).
 * Decorative by default; pass `label` to expose it as a live status.
 * Never use it for whole pages: use <Skeleton> placeholders instead.
 *
 * Props: size (px, default 20), label (a11y text), className.
 */
export interface SpinnerProps {
  size?: number;
  label?: string;
  className?: string;
}

export function Spinner({ size = 20, label, className }: SpinnerProps) {
  return (
    <span
      className={cn(
        'inline-block flex-none animate-spin rounded-full border-[3px] border-current border-t-transparent',
        className,
      )}
      style={{ width: size, height: size }}
      {...(label ? { role: 'status', 'aria-label': label } : { 'aria-hidden': true })}
    />
  );
}
