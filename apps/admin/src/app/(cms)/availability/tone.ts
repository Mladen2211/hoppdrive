import type { CalTone } from '@/lib/calendar-model';

// Full class strings are written out so Tailwind keeps them.

/** Gantt bars and legend swatches (docs/design Calendar-Desktop: .gb-ok / .gb-blue / .gb-amb / .gb-gray). */
export const BAR_TONE: Record<CalTone, string> = {
  ok: 'border-edge-ok bg-ok-tint text-ok-ink',
  info: 'border-edge-info bg-info-tint text-info-ink',
  amber: 'border-dashed border-edge-warn bg-warn-tint text-warn-ink',
  gray: 'border-edge-gray bg-[repeating-linear-gradient(135deg,rgb(var(--c-stripe-a))_0,rgb(var(--c-stripe-a))_6px,rgb(var(--c-stripe-b))_6px,rgb(var(--c-stripe-b))_12px)] text-mute-ink',
  mute: 'border-line bg-mute-tint text-mute-ink',
};

/** Chips in the month grid (.ev.ok / .blue / .amb / .gray). */
export const CHIP_TONE: Record<CalTone, string> = {
  ok: 'bg-ok-tint text-ok-ink',
  info: 'bg-info-tint text-info-ink',
  amber: 'bg-warn-tint text-warn-ink',
  gray: 'bg-mute-tint text-mute-ink',
  mute: 'bg-mute-tint text-mute-ink',
};
