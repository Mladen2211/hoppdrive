/**
 * B2C UI primitives (design system foundation).
 * Import from '@/components/ui'. Styling lives in the component classes of
 * src/app/globals.css (`.btn`, `.in`, `.chip`, `.badge`, `.pp`, ...); the
 * React wrappers add accessibility, state and behaviour.
 */
export { cn } from './cn';
export { useFocusTrap, useLockBodyScroll, useMediaQuery } from './hooks';

export { Spinner } from './Spinner';
export type { SpinnerProps } from './Spinner';
export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';
export { IconButton } from './IconButton';
export type { IconButtonProps } from './IconButton';

export { Field, useFieldControl } from './Field';
export type { FieldProps, FieldControlProps } from './Field';
export { Input } from './Input';
export type { InputProps } from './Input';
export { Select } from './Select';
export type { SelectProps } from './Select';
export { Textarea } from './Textarea';
export type { TextareaProps } from './Textarea';
export { Checkbox } from './Checkbox';
export type { CheckboxProps } from './Checkbox';
export { Switch } from './Switch';
export type { SwitchProps } from './Switch';

export { Chip } from './Chip';
export type { ChipProps } from './Chip';
export { Badge } from './Badge';
export type { BadgeProps, BadgeTone } from './Badge';
export { PricePill } from './PricePill';
export type { PricePillProps } from './PricePill';
export { Kicker } from './Kicker';
export type { KickerProps } from './Kicker';
export { Crumbs } from './Crumbs';
export type { CrumbItem } from './Crumbs';

export { Alert } from './Alert';
export type { AlertProps, AlertTone } from './Alert';
export { Skeleton, VehicleCardSkeleton } from './Skeleton';
export type { SkeletonProps } from './Skeleton';
export { Sheet } from './Sheet';
export type { SheetProps } from './Sheet';

export { CarSilhouette } from './CarSilhouette';
export type { CarSilhouetteProps, CarVariant } from './CarSilhouette';
export { SwissCross } from './SwissCross';
export type { SwissCrossProps } from './SwissCross';
