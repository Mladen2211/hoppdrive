import Image from 'next/image';
import { cn } from '@/components/ui';

interface SiteLogoProps {
  /**
   * Size classes of the horizontal logo (car + wordmark, aspect 8.24 : 1). The logo is wide, so the
   * header gives it a height per breakpoint instead of the old 34 px of the wordmark.
   */
  className?: string;
  /** Height class of the stacked logo shown below 360 px (aspect 2.39 : 1). */
  stackedClassName?: string;
  priority?: boolean;
}

/**
 * Header logo: the horizontal logo with the car (`logo-horizontal.svg`). Below 360 px it would
 * shrink until the wordmark is hard to read, so the stacked logo (car above the wordmark) takes over
 * there. Only one of the two is displayed, the footer keeps the stacked logo.
 */
export function SiteLogo({ className, stackedClassName = 'h-11', priority = true }: SiteLogoProps) {
  return (
    <>
      <Image
        src="/logos/logo-horizontal.svg"
        alt="HoppDrive"
        width={414}
        height={50}
        className={cn('hidden w-auto min-[360px]:block', className)}
        unoptimized
        priority={priority}
      />
      <Image
        src="/logos/logo-stacked.svg"
        alt="HoppDrive"
        width={119}
        height={50}
        className={cn('block w-auto min-[360px]:hidden', stackedClassName)}
        unoptimized
        priority={priority}
      />
    </>
  );
}
