/**
 * Pure helpers for the Kalender page (availability): turns bookings, maintenance periods and open
 * inquiries into "items" and lays them out for the three views (Gantt per vehicle, month grid of
 * pickups/returns, mobile agenda).
 *
 * All day keys are LOCAL 'YYYY-MM-DD' strings (toInputDate), never `toISOString().split('T')[0]`:
 * the old calendar built its keys from UTC and shifted bookings by a day around midnight.
 * Keys compare correctly as plain strings.
 */
import { matchVehicleByName } from '@/lib/inquiry';
import { FUEL_TYPE_LABELS, MAINTENANCE_REASON_LABELS, VEHICLE_TYPE_LABELS } from '@/lib/fleet-model';
import { fmtDateLong, fmtDateShort, monthShort, parseDate, toInputDate, weekdayShort } from '@/lib/format';
import { tr } from '@/i18n/active';

// ─── Types ──────────────────────────────────────────────────────

export interface CalVehicle {
  id: string;
  brand: string;
  model: string;
  type?: string;
  isAvailable?: boolean;
  specs?: { fuelType?: string };
}

export interface CalBooking {
  id: string;
  vehicleId: string;
  customerName: string;
  customerEmail?: string | null;
  startDate: string;
  endDate: string;
  status: string;
  notes?: string | null;
  totalPrice?: number;
  currency?: string;
  contractStatus?: string;
  signedAt?: string | null;
  /** Pickup / return carry real times (false = legacy whole-day booking). */
  hasTimes?: boolean;
  vehicle?: { brand: string; model: string } | null;
}

export interface CalMaintenance {
  id: string;
  vehicleId: string;
  startDate: string;
  endDate: string;
  reason: string;
  notes: string | null;
}

export interface CalInquiry {
  id: string;
  fullName: string;
  vehicleOfInterest?: string | null;
  desiredStartDate?: string | null;
  desiredEndDate?: string | null;
  status: string;
}

/** ok = Aktiv, info = Reserviert, amber = offene Anfrage, gray = Wartung, mute = Erledigt */
export type CalTone = 'ok' | 'info' | 'amber' | 'gray' | 'mute';

interface CalItemBase {
  /** Unique, stable key: 'booking:<id>' */
  key: string;
  vehicleId: string | null;
  vehicleName: string;
  startKey: string;
  endKey: string;
  tone: CalTone;
}

export type CalItem =
  | (CalItemBase & { kind: 'booking'; title: string; booking: CalBooking })
  | (CalItemBase & { kind: 'maintenance'; title: string; maintenance: CalMaintenance })
  | (CalItemBase & { kind: 'inquiry'; title: string; inquiry: CalInquiry });

export type CalEventType = 'pickup' | 'return' | 'maintenance' | 'inquiryStart' | 'inquiryEnd';

export interface CalEvent {
  id: string;
  type: CalEventType;
  /** Chip text, e.g. 'Abholung Laura M.' */
  label: string;
  tone: CalTone;
  dayKey: string;
  item: CalItem;
}

// ─── Constants ──────────────────────────────────────────────────

// Month / weekday names and the vehicle / fuel / maintenance labels follow the active language
// (see lib/format and lib/fleet-model).
export { VEHICLE_TYPE_LABELS, FUEL_TYPE_LABELS, MAINTENANCE_REASON_LABELS } from '@/lib/fleet-model';

// ─── Dates ──────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');

export const dayKeyOf = (input: string | Date): string => toInputDate(input);

export function keyFromParts(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Monday = 0 … Sunday = 6 for a day key. */
export function weekdayIndex(key: string): number {
  const d = parseDate(key);
  return d ? (d.getDay() + 6) % 7 : 0;
}

export function addDaysToKey(key: string, days: number): string {
  const d = parseDate(key);
  if (!d) return key;
  d.setDate(d.getDate() + days);
  return toInputDate(d);
}

/** 'Dienstag, 1. Dezember 2026' */
export function longDateLabel(key: string): string {
  const d = parseDate(key);
  if (!d) return key;
  return fmtDateLong(d);
}

/** 'Di 01.12.' (agenda group heading) */
export function agendaDateLabel(key: string): string {
  return `${weekdayShort(weekdayIndex(key))} ${fmtDateShort(key)}`;
}

/** 'Laura Meier' -> 'Laura M.'; a single word stays as it is. */
export function shortName(full: string | null | undefined): string {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '–';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

export const vehicleLabel = (v: { brand: string; model: string } | null | undefined): string =>
  v ? `${v.brand} ${v.model}` : tr('calendarModel.unbekannt');

/** 'Kombi · Diesel' */
export function vehicleMeta(v: CalVehicle): string {
  return [VEHICLE_TYPE_LABELS[v.type ?? ''] ?? v.type, FUEL_TYPE_LABELS[v.specs?.fuelType ?? ''] ?? v.specs?.fuelType]
    .filter(Boolean)
    .join(' · ');
}

// ─── Items ──────────────────────────────────────────────────────

function toneForBooking(status: string): CalTone {
  if (status === 'active') return 'ok';
  if (status === 'reserved') return 'info';
  return 'mute';
}

export interface BuildItemsInput {
  vehicles: CalVehicle[];
  bookings: CalBooking[];
  maintenance: CalMaintenance[];
  inquiries: CalInquiry[];
  /** 'all' or a vehicle id */
  vehicleFilter: string;
}

/**
 * Bookings (cancelled ones excluded, as before), maintenance periods and open inquiries
 * (pending / reviewed, with desired dates; matched to a vehicle like the inquiries page does).
 */
export function buildItems({ vehicles, bookings, maintenance, inquiries, vehicleFilter }: BuildItemsInput): CalItem[] {
  const byId = new Map(vehicles.map((v) => [v.id, v]));
  const pass = (vehicleId: string | null) => vehicleFilter === 'all' || vehicleId === vehicleFilter;
  const items: CalItem[] = [];

  for (const b of bookings) {
    if (b.status === 'cancelled' || !pass(b.vehicleId)) continue;
    const startKey = dayKeyOf(b.startDate);
    const endKey = dayKeyOf(b.endDate);
    if (!startKey || !endKey) continue;
    const v = byId.get(b.vehicleId);
    items.push({
      kind: 'booking',
      key: `booking:${b.id}`,
      vehicleId: b.vehicleId,
      vehicleName: v ? vehicleLabel(v) : vehicleLabel(b.vehicle),
      startKey,
      endKey: endKey < startKey ? startKey : endKey,
      tone: toneForBooking(b.status),
      title: b.customerName,
      booking: b,
    });
  }

  for (const m of maintenance) {
    if (!pass(m.vehicleId)) continue;
    const startKey = dayKeyOf(m.startDate);
    const endKey = dayKeyOf(m.endDate);
    if (!startKey || !endKey) continue;
    const v = byId.get(m.vehicleId);
    items.push({
      kind: 'maintenance',
      key: `maintenance:${m.id}`,
      vehicleId: m.vehicleId,
      vehicleName: v ? vehicleLabel(v) : tr('calendarModel.unbekannt'),
      startKey,
      endKey: endKey < startKey ? startKey : endKey,
      tone: 'gray',
      title: tr('calendarModel.wartung'),
      maintenance: m,
    });
  }

  for (const q of inquiries) {
    if ((q.status !== 'pending' && q.status !== 'reviewed') || !q.desiredStartDate || !q.desiredEndDate) continue;
    const startKey = dayKeyOf(q.desiredStartDate);
    const endKey = dayKeyOf(q.desiredEndDate);
    if (!startKey || !endKey) continue;
    const match = matchVehicleByName(vehicles, q.vehicleOfInterest);
    if (!pass(match?.id ?? null)) continue;
    items.push({
      kind: 'inquiry',
      key: `inquiry:${q.id}`,
      vehicleId: match?.id ?? null,
      vehicleName: match ? vehicleLabel(match) : q.vehicleOfInterest?.trim() || tr('calendarModel.fahrzeugOffen'),
      startKey,
      endKey: endKey < startKey ? startKey : endKey,
      tone: 'amber',
      title: q.fullName,
      inquiry: q,
    });
  }

  return items;
}

/** Vehicles for the Gantt rows: the list, plus vehicles only known from a booking (e.g. a removed one). */
export function ganttVehicles(vehicles: CalVehicle[], items: CalItem[], vehicleFilter: string): CalVehicle[] {
  const sorted = [...vehicles].sort((a, b) => vehicleLabel(a).localeCompare(vehicleLabel(b), 'de'));
  if (vehicleFilter !== 'all') return sorted.filter((v) => v.id === vehicleFilter);
  const known = new Set(sorted.map((v) => v.id));
  const extra = new Map<string, CalVehicle>();
  for (const item of items) {
    if (item.vehicleId && !known.has(item.vehicleId) && !extra.has(item.vehicleId)) {
      const [brand, ...rest] = item.vehicleName.split(' ');
      extra.set(item.vehicleId, { id: item.vehicleId, brand, model: rest.join(' ') });
    }
  }
  return [...sorted, ...extra.values()];
}

// ─── Month layout ───────────────────────────────────────────────

export interface MonthDay {
  key: string;
  day: number;
  /** Monday = 0 … Sunday = 6 */
  weekday: number;
  weekend: boolean;
}

export function monthDays(year: number, month: number): MonthDay[] {
  const n = daysInMonth(year, month);
  return Array.from({ length: n }, (_, i) => {
    const key = keyFromParts(year, month, i + 1);
    const weekday = (new Date(year, month, i + 1).getDay() + 6) % 7;
    return { key, day: i + 1, weekday, weekend: weekday >= 5 };
  });
}

export interface GridCell {
  key: string;
  day: number;
  month: number;
  inMonth: boolean;
  /** '5' inside the month, '30. Nov' outside */
  label: string;
}

/** Mon-first weeks covering the month (5 or 6 rows). */
export function monthGrid(year: number, month: number): GridCell[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const total = Math.ceil((offset + daysInMonth(year, month)) / 7) * 7;
  const cells: GridCell[] = [];
  for (let i = 0; i < total; i++) {
    const d = new Date(year, month, 1 - offset + i);
    const inMonth = d.getMonth() === month;
    cells.push({
      key: toInputDate(d),
      day: d.getDate(),
      month: d.getMonth(),
      inMonth,
      label: inMonth ? String(d.getDate()) : `${d.getDate()}. ${monthShort(d.getMonth())}`,
    });
  }
  return cells;
}

// ─── Gantt ──────────────────────────────────────────────────────

export interface GanttBar {
  item: CalItem;
  /** 0-based day column of the first visible day */
  startIdx: number;
  /** 0-based day column of the last visible day (inclusive) */
  endIdx: number;
  clippedStart: boolean;
  clippedEnd: boolean;
  lane: number;
}

/** Bars of one vehicle, clipped to the month and packed into lanes so overlapping items never sit on top of each other. */
export function ganttBars(
  items: CalItem[],
  monthStartKey: string,
  monthEndKey: string,
  dayCount: number,
): { bars: GanttBar[]; lanes: number } {
  const clipped = items
    .filter((item) => item.endKey >= monthStartKey && item.startKey <= monthEndKey)
    .map((item) => {
      const clippedStart = item.startKey < monthStartKey;
      const clippedEnd = item.endKey > monthEndKey;
      const startIdx = clippedStart ? 0 : Number(item.startKey.slice(8, 10)) - 1;
      const endIdx = clippedEnd ? dayCount - 1 : Number(item.endKey.slice(8, 10)) - 1;
      return { item, startIdx, endIdx, clippedStart, clippedEnd };
    })
    .sort((a, b) => a.startIdx - b.startIdx || b.endIdx - a.endIdx);

  const laneEnds: number[] = [];
  const bars: GanttBar[] = clipped.map((c) => {
    let lane = laneEnds.findIndex((end) => end < c.startIdx);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(c.endIdx);
    } else {
      laneEnds[lane] = c.endIdx;
    }
    return { ...c, lane };
  });
  return { bars, lanes: Math.max(1, laneEnds.length) };
}

/** 'Nadia Frei (bis 10.02.)' when the booking runs past the visible month. */
export function barLabel(bar: GanttBar): string {
  const { item } = bar;
  if (item.kind === 'inquiry') return tr('calendarModel.anfrage', { title: item.title });
  if (item.kind === 'maintenance') return tr('calendarModel.wartung');
  return bar.clippedEnd ? tr('calendarModel.bis', { title: item.title, dateShort: fmtDateShort(item.endKey) }) : item.title;
}

/** Full sentence for screen readers and tooltips. */
export function itemDescription(item: CalItem): string {
  const range = `${fmtDateShort(item.startKey)} bis ${fmtDateShort(item.endKey)}`;
  if (item.kind === 'booking') {
    const status = { active: tr('calendarModel.aktiv'), reserved: tr('calendarModel.reserviert'), completed: tr('calendarModel.erledigt') }[item.booking.status] ?? item.booking.status;
    return `${item.title}, ${item.vehicleName}, ${range}, ${status}`;
  }
  if (item.kind === 'maintenance') {
    const reason = MAINTENANCE_REASON_LABELS[item.maintenance.reason] ?? item.maintenance.reason;
    return tr('calendarModel.wartung2', { vehicleName: item.vehicleName, range, reason, value: item.maintenance.notes ? `, ${item.maintenance.notes}` : '' });
  }
  return tr('calendarModel.offeneAnfrageVon', { title: item.title, vehicleName: item.vehicleName, range });
}

// ─── Events (pickups and returns) ───────────────────────────────

const EVENT_ORDER: Record<CalEventType, number> = {
  inquiryEnd: 0,
  return: 0,
  maintenance: 1,
  pickup: 2,
  inquiryStart: 2,
};

/** Events per day key for the given keys only. */
export function eventsByDay(items: CalItem[], keys: Iterable<string>): Map<string, CalEvent[]> {
  const wanted = new Set(keys);
  const map = new Map<string, CalEvent[]>();
  const add = (event: CalEvent) => {
    if (!wanted.has(event.dayKey)) return;
    const list = map.get(event.dayKey);
    if (list) list.push(event);
    else map.set(event.dayKey, [event]);
  };

  for (const item of items) {
    if (item.kind === 'booking') {
      const who = shortName(item.title);
      add({ id: `${item.key}:pickup`, type: 'pickup', label: tr('calendarModel.abholung', { who }), tone: item.tone, dayKey: item.startKey, item });
      add({ id: `${item.key}:return`, type: 'return', label: tr('calendarModel.rueckgabe', { who }), tone: item.tone, dayKey: item.endKey, item });
    } else if (item.kind === 'maintenance') {
      const model = item.vehicleName.split(' ').slice(1).join(' ') || item.vehicleName;
      add({ id: `${item.key}:maintenance`, type: 'maintenance', label: tr('calendarModel.wartung3', { model }), tone: 'gray', dayKey: item.startKey, item });
    } else {
      const who = shortName(item.title);
      add({ id: `${item.key}:start`, type: 'inquiryStart', label: tr('calendarModel.anfrage2', { who }), tone: 'amber', dayKey: item.startKey, item });
      add({ id: `${item.key}:end`, type: 'inquiryEnd', label: tr('calendarModel.rueckgabe', { who }), tone: 'amber', dayKey: item.endKey, item });
    }
  }

  map.forEach((list) => list.sort((a, b) => EVENT_ORDER[a.type] - EVENT_ORDER[b.type] || a.label.localeCompare(b.label, 'de')));
  return map;
}

/** Everything that is going on during a day (a booking counts for every day from pickup to return). */
export function itemsOnDay(items: CalItem[], key: string): CalItem[] {
  return items.filter((item) => item.startKey <= key && item.endKey >= key);
}

// ─── Agenda ─────────────────────────────────────────────────────

export interface AgendaGroup {
  dayKey: string;
  heading: string;
  events: CalEvent[];
}

export function agendaGroups(items: CalItem[], days: MonthDay[]): AgendaGroup[] {
  const byDay = eventsByDay(items, days.map((d) => d.key));
  return days
    .filter((d) => byDay.has(d.key))
    .map((d) => ({ dayKey: d.key, heading: agendaDateLabel(d.key), events: byDay.get(d.key) ?? [] }));
}

// ─── Upcoming bookings ──────────────────────────────────────────

/** The next bookings (not cancelled, not yet over), earliest first. */
export function upcomingBookings(bookings: CalBooking[], vehicleFilter: string, todayKey: string, limit = 8): CalBooking[] {
  return bookings
    .filter((b) => b.status !== 'cancelled' && dayKeyOf(b.endDate) >= todayKey && (vehicleFilter === 'all' || b.vehicleId === vehicleFilter))
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, limit);
}
