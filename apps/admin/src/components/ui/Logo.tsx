import Image from 'next/image';
import { cn } from './cn';

/** Natural aspect ratios of the SVG viewBoxes (public/logos). */
const RATIO = { horizontal: 1657 / 201, stacked: 1095 / 459 } as const;

export interface LogoProps {
  /** 'horizontal': car + wordmark in one line. 'stacked': car above the wordmark (compact rail, auth cards). */
  variant?: 'horizontal' | 'stacked';
  /** Rendered height in px; the width follows the logo's aspect ratio. */
  height: number;
  className?: string;
  priority?: boolean;
  /** Empty for a decorative logo next to the product name. */
  alt?: string;
}

/**
 * The full HoppDrive logo (with the car). Renders the charcoal and the white SVG and lets CSS pick
 * one from <html data-theme> (.logo-on-light / .logo-on-dark in globals.css), so the right variant
 * shows from the very first paint without a script or a hydration flash.
 */
export function Logo({ variant = 'horizontal', height, className, priority, alt = 'HoppDrive' }: LogoProps) {
  const width = Math.round(height * RATIO[variant]);
  const common = {
    width,
    height,
    unoptimized: true,
    priority,
    style: { height, width: 'auto' } as const,
  };
  return (
    <>
      <Image src={`/logos/logo-${variant}.svg`} alt={alt} className={cn('logo-on-light', className)} {...common} />
      <Image src={`/logos/logo-${variant}-white.svg`} alt={alt} className={cn('logo-on-dark', className)} {...common} />
    </>
  );
}
