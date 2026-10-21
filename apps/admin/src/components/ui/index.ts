/**
 * Admin UI primitives (design system foundation).
 * Import from '@/components/ui'. Styling lives in the component classes of
 * src/app/globals.css (`.btn`, `.in`, `.st`, `.panel`, ...); the React
 * wrappers add accessibility, state and behaviour.
 *
 * App-level providers (mounted once by the shell):
 *   <ToastProvider>  -> useToast()
 *   <ConfirmProvider> -> useConfirm()
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
export { Chip, ChipGroup } from './Chip';
export type { ChipProps, ChipGroupProps, ChipOption } from './Chip';
export { Tabs, TabPanel } from './Tabs';
export type { TabsProps, TabItem, TabPanelProps } from './Tabs';

export { StatusPill, STATUS_MAP, statusLabel, statusTone, deriveInvoiceStatus } from './StatusPill';
export type { StatusPillProps, StatusKind, StatusTone } from './StatusPill';
export { Avatar, initialsOf } from './Avatar';
export type { AvatarProps } from './Avatar';

export { Panel, PanelHeader, PanelBody } from './Panel';
export type { PanelProps, PanelHeaderProps } from './Panel';
export { KpiCard } from './KpiCard';
export type { KpiCardProps } from './KpiCard';
export { Table, THead, TBody, Th, Tr, Td, Cell2, MobileCard, ResponsiveList } from './Table';
export type { TableProps, ThProps, TrProps, TdProps, MobileCardProps, ResponsiveListProps } from './Table';
export { PageHeader } from './PageHeader';
export type { PageHeaderProps } from './PageHeader';
export { ProgressSteps } from './ProgressSteps';
export type { ProgressStepsProps, ProgressStep, StepState } from './ProgressSteps';
export { Menu } from './Menu';
export type { MenuProps, MenuItem, MenuTriggerProps } from './Menu';

export { Drawer, DrawerLayout } from './Drawer';
export type { DrawerProps, DrawerMode } from './Drawer';
export { Modal } from './Modal';
export type { ModalProps } from './Modal';
export { ConfirmDialog, ConfirmProvider, useConfirm } from './ConfirmDialog';
export type { ConfirmDialogProps, ConfirmOptions, ConfirmFn } from './ConfirmDialog';
export { ToastProvider, useToast } from './Toast';
export type { ToastOptions, ToastTone, ToastApi, ToastFn } from './Toast';

export { Alert } from './Alert';
export type { AlertProps, AlertTone } from './Alert';
export { Skeleton, SkeletonRows, SkeletonTableRows } from './Skeleton';
export type { SkeletonProps, SkeletonRowsProps } from './Skeleton';
export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';
export { NoAccess } from './NoAccess';
export type { NoAccessProps } from './NoAccess';
export { Logo } from './Logo';
export type { LogoProps } from './Logo';
