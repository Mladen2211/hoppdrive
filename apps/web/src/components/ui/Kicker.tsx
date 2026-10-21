/**
 * Kicker: small ruby section label with the Swiss cross in front
 * ("Unsere Flotte", "Warum HoppDrive", "Preismodell"). Reserved for section
 * kickers: never use the cross as a bullet or pattern.
 *
 *   <Kicker>Kurz- &amp; Langzeitvermietung Schweiz</Kicker>
 *   <Kicker as="span">Preismodell</Kicker>
 *
 * Props: as ('p' default | 'span' | 'div'), className.
 */
import type { ReactNode } from 'react';
import { cn } from './cn';

export interface KickerProps {
  as?: 'p' | 'span' | 'div';
  className?: string;
  children: ReactNode;
}

export function Kicker({ as: Tag = 'p', className, children }: KickerProps) {
  return <Tag className={cn('kick', className)}>{children}</Tag>;
}
