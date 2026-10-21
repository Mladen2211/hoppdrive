'use client';

/**
 * Button / link-button (admin design system: 44 px, 48 px on mobile, small 36 px).
 *
 * Props:
 *  - variant: 'primary' (ruby, default) | 'outline' | 'ghost' | 'danger'
 *  - size: 'md' (default) | 'sm'
 *  - loading: shows a spinner, sets aria-busy and ignores clicks (keeps the colour)
 *  - iconLeft / iconRight: lucide icon nodes (use size 18-20)
 *  - fullWidth: width 100%
 *  - href: renders a link (next/link for internal paths, <a> otherwise)
 *  - everything else is passed to the underlying <button> / <a>
 *
 * `type` defaults to "button" so a Button inside a <form> never submits by
 * accident; pass `type="submit"` explicitly for submit buttons.
 */
import Link from 'next/link';
import {
  forwardRef,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { cn } from './cn';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

interface ButtonBaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
  children?: ReactNode;
}

export type ButtonAsButtonProps = ButtonBaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { href?: undefined };

export type ButtonAsLinkProps = ButtonBaseProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children'> & { href: string; disabled?: boolean };

export type ButtonProps = ButtonAsButtonProps | ButtonAsLinkProps;

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'btn-p',
  outline: 'btn-o',
  ghost: 'btn-g',
  danger: 'btn-d',
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  md: '',
  sm: 'btn-s',
};

function isInternalHref(href: string): boolean {
  return (href.startsWith('/') && !href.startsWith('//')) || href.startsWith('#') || href.startsWith('?');
}

export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  function Button(props, ref) {
    const {
      variant = 'primary',
      size = 'md',
      loading = false,
      iconLeft,
      iconRight,
      fullWidth = false,
      className,
      children,
      ...rest
    } = props;

    const classes = cn('btn', VARIANT_CLASS[variant], SIZE_CLASS[size], fullWidth && 'btn-b', className);
    const content = (
      <>
        {loading ? <Spinner size={size === 'sm' ? 14 : 18} /> : iconLeft}
        {children}
        {!loading && iconRight}
      </>
    );

    if (typeof rest.href === 'string') {
      const { href, disabled, onClick, target, rel, ...anchorRest } = rest as ButtonAsLinkProps;
      const blocked = Boolean(disabled) || loading;
      const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
        if (blocked) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      };
      const common = {
        ...anchorRest,
        className: classes,
        onClick: handleClick,
        'aria-disabled': blocked || undefined,
        'aria-busy': loading || undefined,
        'data-loading': loading ? '' : undefined,
        tabIndex: blocked ? -1 : anchorRest.tabIndex,
      };
      if (isInternalHref(href) && !target && !anchorRest.download) {
        return (
          <Link ref={ref as Ref<HTMLAnchorElement>} href={href} {...common}>
            {content}
          </Link>
        );
      }
      return (
        <a
          ref={ref as Ref<HTMLAnchorElement>}
          href={href}
          target={target}
          rel={target === '_blank' ? (rel ?? 'noopener noreferrer') : rel}
          {...common}
        >
          {content}
        </a>
      );
    }

    const { type = 'button', disabled, onClick, ...buttonRest } = rest as ButtonAsButtonProps;
    return (
      <button
        ref={ref as Ref<HTMLButtonElement>}
        type={type}
        {...buttonRest}
        className={classes}
        disabled={disabled}
        aria-busy={loading || undefined}
        aria-disabled={loading || undefined}
        data-loading={loading ? '' : undefined}
        onClick={loading ? (event) => event.preventDefault() : onClick}
      >
        {content}
      </button>
    );
  },
);
