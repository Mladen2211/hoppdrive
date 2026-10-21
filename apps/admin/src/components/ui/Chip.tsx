'use client';

/**
 * Filter chip (toggle button with aria-pressed) and ChipGroup.
 *
 * <Chip pressed={filter === 'open'} count={5} onClick={...}>Offen</Chip>
 *
 * Chip props: pressed (aria-pressed), count (small number after the label),
 *   plus native <button> props.
 *
 * <ChipGroup aria-label="Status" options={[{ value: 'all', label: 'Alle', count: 12 }]}
 *            value={status} onChange={setStatus} />
 * <ChipGroup multiple options={...} value={['a', 'b']} onChange={setList} />
 *
 * ChipGroup props:
 *  - options: { value, label, count?, disabled? }[]
 *  - value / onChange: single value, or string[] when `multiple`
 *  - scrollable: single scrolling row on mobile instead of wrapping
 *  - aria-label: group name (required for screen readers)
 * A single-select group behaves like radio buttons: the active chip stays active.
 */
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  pressed?: boolean;
  count?: number | string;
}

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { pressed = false, count, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} aria-pressed={pressed} className={cn('chip', className)} {...rest}>
      {children}
      {count !== undefined && <small>{count}</small>}
    </button>
  );
});

export interface ChipOption<T extends string = string> {
  value: T;
  label: ReactNode;
  count?: number | string;
  disabled?: boolean;
}

type ChipGroupSelection<T extends string> =
  | { multiple?: false; value: T; onChange: (value: T) => void }
  | { multiple: true; value: T[]; onChange: (value: T[]) => void };

export type ChipGroupProps<T extends string = string> = ChipGroupSelection<T> & {
  options: ChipOption<T>[];
  'aria-label': string;
  scrollable?: boolean;
  className?: string;
};

export function ChipGroup<T extends string = string>(props: ChipGroupProps<T>) {
  const { options, scrollable = false, className } = props;

  const isPressed = (value: T) => (props.multiple ? props.value.includes(value) : props.value === value);

  const select = (value: T) => {
    if (props.multiple) {
      props.onChange(props.value.includes(value) ? props.value.filter((v) => v !== value) : [...props.value, value]);
    } else if (props.value !== value) {
      props.onChange(value);
    }
  };

  return (
    <div
      role="group"
      aria-label={props['aria-label']}
      className={cn('chips', scrollable && 'max-md:flex-nowrap max-md:overflow-x-auto max-md:pb-1', className)}
    >
      {options.map((option) => (
        <Chip
          key={option.value}
          pressed={isPressed(option.value)}
          count={option.count}
          disabled={option.disabled}
          onClick={() => select(option.value)}
        >
          {option.label}
        </Chip>
      ))}
    </div>
  );
}
