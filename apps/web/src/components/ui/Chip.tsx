'use client';

/**
 * Filter chip (44 px pill). Two flavours, same look:
 *  - toggle button (default): aria-pressed, for client-side filters
 *      <Chip pressed={type === 'suv'} count={5} onClick={() => setType('suv')}>SUV</Chip>
 *  - link (give `href`): for category filters that must stay crawlable (SEO);
 *    the active one gets aria-current="page"
 *      <Chip href="/mieten/suv" pressed count={5}>SUV</Chip>
 *
 * Props: pressed (active), count (small number after the label), href, plus
 * native <button> / <a> props.
 * Wrap several chips in <div className="chips"> (wraps) or
 * <div className="chips max-md:flex-nowrap max-md:overflow-x-auto"> (one scrolling row on mobile).
 */
import {
  forwardRef,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react';
import { Link } from '@/i18n/navigation';
import { cn } from './cn';

interface ChipBaseProps {
  pressed?: boolean;
  count?: number | string;
  children?: ReactNode;
}

export type ChipProps = ChipBaseProps &
  (
    | (Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { href?: undefined })
    | (Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children'> & { href: string })
  );

export const Chip = forwardRef<HTMLButtonElement | HTMLAnchorElement, ChipProps>(function Chip(props, ref) {
  const { pressed = false, count, className, children, ...rest } = props;
  const content = (
    <>
      {children}
      {count !== undefined && <small>{count}</small>}
    </>
  );

  if (typeof rest.href === 'string') {
    const { href, ...anchorRest } = rest as AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };
    return (
      <Link
        ref={ref as Ref<HTMLAnchorElement>}
        href={href}
        aria-current={pressed ? 'page' : undefined}
        className={cn('chip no-underline', className)}
        {...anchorRest}
      >
        {content}
      </Link>
    );
  }

  const { type = 'button', ...buttonRest } = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button
      ref={ref as Ref<HTMLButtonElement>}
      type={type}
      aria-pressed={pressed}
      className={cn('chip', className)}
      {...buttonRest}
    >
      {content}
    </button>
  );
});
