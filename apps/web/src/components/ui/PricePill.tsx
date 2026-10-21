/**
 * PricePill: the "Richtpreis" box (ruby-tint fill, small label, big price in
 * Fira Sans Condensed, optional sub line). Use it for the live estimate in the
 * quick-request bar and the contact form.
 *
 *   <PricePill label="Richtpreis, 14 Tage" price="CHF 995.40" sub="CHF 71.10 / Tag, Rabatt ab Tag 8" live />
 *   <PricePill price="Ab CHF 85 / Tag" sub="Wählen Sie Beginn und Ende für einen Richtpreis." />
 *
 * Props: label (small, above), price (big), sub (small, below), live (announce
 * changes politely to screen readers), className.
 * Always show "Richtpreis" as an estimate, never as a binding offer.
 */
import type { ReactNode } from 'react';
import { cn } from './cn';

export interface PricePillProps {
  label?: ReactNode;
  price: ReactNode;
  sub?: ReactNode;
  live?: boolean;
  className?: string;
}

export function PricePill({ label, price, sub, live = false, className }: PricePillProps) {
  return (
    <div className={cn('pp', className)} {...(live ? { 'aria-live': 'polite' as const, 'aria-atomic': true } : {})}>
      {label && <span>{label}</span>}
      <b>{price}</b>
      {sub && <span>{sub}</span>}
    </div>
  );
}
