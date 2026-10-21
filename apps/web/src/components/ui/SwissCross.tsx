/**
 * SwissCross: the brand mark pieces for the hero stage and logo-like badges.
 * Decorative (aria-hidden). Reserved for the logo, the hero and the road in
 * the header area; never use it as a pattern or bullet.
 *
 *   <SwissCross variant="cross" className="absolute -right-16 -top-16 h-80 w-80 text-white opacity-[.13]" />
 *   <SwissCross variant="square" size={56} />     ruby rounded square, white cross (app-icon style)
 *   <SwissCross variant="circle" size={40} />     ruby circle, white cross (logo mark)
 *
 * Props: variant ('square' default | 'circle' | 'cross'), size (px; omit to size with
 *   className), className. 'cross' draws only the plus shape in currentColor
 *   (arms are 30 % wide, like the hero stage); 'square' and 'circle' use the brand
 *   ruby (#A60E0E) with a white cross.
 */
import { cn } from './cn';

export interface SwissCrossProps {
  variant?: 'square' | 'circle' | 'cross';
  size?: number;
  className?: string;
}

export function SwissCross({ variant = 'square', size, className }: SwissCrossProps) {
  const dimensions = size ? { width: size, height: size } : {};

  if (variant === 'cross') {
    return (
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false" className={cn('flex-none', className)} {...dimensions}>
        <path d="M35 0h30v35h35v30H65v35H35V65H0V35h35z" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={cn('flex-none', className)} {...dimensions}>
      {variant === 'circle' ? (
        <circle cx="12" cy="12" r="12" fill="#A60E0E" />
      ) : (
        <rect width="24" height="24" rx="5" fill="#A60E0E" />
      )}
      <path d="M9 4h6v5h5v6h-5v5H9v-5H4V9h5z" fill="#fff" />
    </svg>
  );
}
