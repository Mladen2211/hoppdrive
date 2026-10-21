'use client';

import {
  Download,
  Eye,
  FileSignature,
  Mail,
  PenTool,
  Plus,
  QrCode,
  Receipt,
  RefreshCw,
  Search,
  Tablet,
  CircleCheck,
  CircleX,
  Wrench,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import type { CreateInvoiceRequest } from '@hoppdrive/shared';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Cell2,
  ChipGroup,
  DrawerLayout,
  EmptyState,
  IconButton,
  Input,
  Menu,
  MobileCard,
  PageHeader,
  Panel,
  ProgressSteps,
  SkeletonRows,
  SkeletonTableRows,
  StatusPill,
  Table,
  Tabs,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  cn,
  useConfirm,
  useMediaQuery,
  useToast,
  type MenuItem,
} from '@/components/ui';
import { useNewBooking } from '@/components/NewBookingModal';
import { useShellCounts } from '@/components/shell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useCurrency } from '@/hooks/useCurrency';
import { useCan } from '@/hooks/usePermission';
import { api } from '@/lib/api';
import { bookingProgress, contractFilename, contractNumber, invoiceFilename } from '@/lib/booking';
import { fetchBookings } from '@/lib/bookings';
import { triggerBlobDownload } from '@/lib/download';
import { errorText } from '@/lib/errors';
import { fmtDate, fmtDateShort, fmtMoney } from '@/lib/format';
import { qrBillError, qrMissingList as qrMissingListText, type InvoiceKind } from '@/lib/invoice-model';
import { BookingDetail } from './BookingDetail';
import { BookingEditModal } from './BookingEditModal';
import { CreateInvoiceModal, DunningModal, EmailModal, type InvoiceModalError } from './dialogs';
import {
  canInvoice,
  invoiceState,
  invoiceTypeOf,
  vehicleOf,
  type Booking,
  type BookingStatusFilter,
  type ContractActions,
  type ContractFilter,
  type Invoice,
  type InvoiceFilter,
  type InvoiceTypeFilter,
} from './types';
import { useTranslations } from 'next-intl';
import { tr } from '@/i18n/active';

const SignaturePad = dynamic(() => import('@/components/SignaturePad'), { ssr: false });

/** ?newInvoice= values of the deep link. */
const NEW_INVOICE_KINDS = new Map<string, InvoiceKind>([
  ['damage', 'DAMAGE'],
  ['fine', 'FINE'],
  ['other', 'OTHER'],
]);

const periodText = (b: Booking) => `${fmtDateShort(b.startDate)} – ${fmtDateShort(b.endDate)}`;
const priceText = (b: Booking, fallbackCurrency: string) =>
  b.status === 'cancelled' || !b.totalPrice ? '–' : fmtMoney(b.totalPrice, { currency: b.currency || fallbackCurrency });

export default function ContractsPage() {
  return (
    <Suspense fallback={<SkeletonRows rows={6} />}>
      <ContractsView />
    </Suspense>
  );
}

function ContractsView() {
  const tt = useTranslations();
  const t = useTranslations();
  const { token } = useAdminAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const newBooking = useNewBooking();
  const { refresh: refreshCounts } = useShellCounts();
  const canEdit = useCan('contracts', 'edit');
  const businessCurrency = useCurrency();
  const isTabletUp = useMediaQuery('(min-width: 768px)');
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isXl = useMediaQuery('(min-width: 1280px)');
  const isWide = useMediaQuery('(min-width: 1800px)');

  const tab: 'buchungen' | 'rechnungen' = searchParams.get('tab') === 'rechnungen' ? 'rechnungen' : 'buchungen';
  const selectedId = searchParams.get('id');
  const invoiceParam = searchParams.get('invoice');
  // ?tab=rechnungen&newInvoice=damage|fine|other&bookingId=<id>: opens the create-invoice dialog (e.g. after a return inspection).
  const newInvoiceParam = searchParams.get('newInvoice');
  const newInvoiceBookingId = searchParams.get('bookingId');

  // Data
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [invoicesFailed, setInvoicesFailed] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<BookingStatusFilter>('all');
  const [contractFilter, setContractFilter] = useState<ContractFilter>('all');
  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceFilter>('all');
  const [invoiceTypeFilter, setInvoiceTypeFilter] = useState<InvoiceTypeFilter>('all');
  const [search, setSearch] = useState('');

  // Dialogs and running requests
  const [busyId, setBusyId] = useState<string | null>(null);
  const [signing, setSigning] = useState<Booking | null>(null);
  const [signingLoading, setSigningLoading] = useState(false);
  const [emailBooking, setEmailBooking] = useState<Booking | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [invoiceDialog, setInvoiceDialog] = useState<{ open: boolean; booking: Booking | null; kind?: InvoiceKind; autoDamages?: boolean }>({ open: false, booking: null });
  const [invoiceCreating, setInvoiceCreating] = useState(false);
  const [invoiceError, setInvoiceError] = useState<InvoiceModalError | null>(null);
  const [dunningInvoice, setDunningInvoice] = useState<Invoice | null>(null);
  const [dunningSending, setDunningSending] = useState(false);
  const [dunningError, setDunningError] = useState<string | null>(null);

  // ── Loading ───────────────────────────────────────────────────

  const load = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      const [bookingRes, invoiceRes] = await Promise.allSettled([fetchBookings(), api.getInvoices()]);
      if (bookingRes.status === 'fulfilled') {
        setBookings((bookingRes.value.items || []) as Booking[]);
        setLoadError(null);
      } else if (!silent) {
        setLoadError(errorText(bookingRes.reason, tr('contracts.dieBuchungenKonntenNicht')));
      }
      if (invoiceRes.status === 'fulfilled') {
        setInvoices(invoiceRes.value as Invoice[]);
        setInvoicesFailed(false);
      } else {
        setInvoicesFailed(true);
      }
      setLoading(false);
    },
    [token],
  );

  const { bookingsVersion } = newBooking;
  useEffect(() => {
    void load(bookingsVersion > 0);
  }, [load, bookingsVersion]);

  // ── Derived data ──────────────────────────────────────────────

  const invoicesByBooking = useMemo(() => {
    const map = new Map<string, Invoice[]>();
    invoices.forEach((inv) => {
      if (inv.bookingId) map.set(inv.bookingId, [...(map.get(inv.bookingId) ?? []), inv]);
    });
    return map;
  }, [invoices]);

  const statusCounts = useMemo(() => {
    const count = (s: string) => bookings.filter((b) => b.status === s).length;
    return { all: bookings.length, reserved: count('reserved'), active: count('active'), completed: count('completed'), cancelled: count('cancelled') };
  }, [bookings]);

  const contractCounts = useMemo(
    () => ({
      all: bookings.length,
      pending: bookings.filter((b) => (b.contractStatus || 'PENDING') === 'PENDING' && b.status !== 'cancelled').length,
      signed: bookings.filter((b) => b.contractStatus === 'SIGNED').length,
    }),
    [bookings],
  );

  const filteredBookings = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookings
      .filter((b) => statusFilter === 'all' || b.status === statusFilter)
      .filter((b) => {
        if (contractFilter === 'pending') return (b.contractStatus || 'PENDING') === 'PENDING' && b.status !== 'cancelled';
        if (contractFilter === 'signed') return b.contractStatus === 'SIGNED';
        return true;
      })
      .filter((b) => {
        if (!q) return true;
        return (
          b.customerName.toLowerCase().includes(q) ||
          (b.customerEmail?.toLowerCase().includes(q) ?? false) ||
          vehicleOf(b).toLowerCase().includes(q) ||
          b.id.toLowerCase().includes(q) ||
          contractNumber(b.id).toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [bookings, statusFilter, contractFilter, search]);

  const invoiceCounts = useMemo(() => {
    const states = invoices.map(invoiceState);
    return {
      all: invoices.length,
      open: states.filter((s) => s === 'PENDING').length,
      overdue: states.filter((s) => s === 'OVERDUE').length,
      paid: states.filter((s) => s === 'PAID').length,
    };
  }, [invoices]);

  const invoiceTypeCounts = useMemo(() => {
    const count = (type: string) => invoices.filter((inv) => invoiceTypeOf(inv) === type).length;
    return { all: invoices.length, RENTAL: count('RENTAL'), DAMAGE: count('DAMAGE'), FINE: count('FINE'), OTHER: count('OTHER') };
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      const state = invoiceState(inv);
      if (invoiceFilter === 'open' && state !== 'PENDING') return false;
      if (invoiceFilter === 'overdue' && state !== 'OVERDUE') return false;
      if (invoiceFilter === 'paid' && state !== 'PAID') return false;
      if (invoiceTypeFilter !== 'all' && invoiceTypeOf(inv) !== invoiceTypeFilter) return false;
      if (!q) return true;
      return inv.invoiceNumber.toLowerCase().includes(q) || (inv.customerName ?? inv.booking?.customerName ?? '').toLowerCase().includes(q);
    });
  }, [invoices, invoiceFilter, invoiceTypeFilter, search]);

  const selectedBooking = useMemo(() => bookings.find((b) => b.id === selectedId) ?? null, [bookings, selectedId]);
  // The persistent drawer (>= 1024 px) narrows the table: the Fortschritt column then moves into the drawer (same on tablet); on desktop it shows dots below 1280 px (labels stay readable by screen readers).
  const drawerInline = Boolean(selectedBooking) && isDesktop;
  const compactTable = drawerInline || !isDesktop; // tablet and drawer-open layouts: no progress column, fewer row icons
  const showProgress = !compactTable;
  const progressLabels = isWide || isXl;

  // ── URL state ─────────────────────────────────────────────────

  const goTab = useCallback(
    (next: string) => {
      setSearch('');
      router.replace(next === 'rechnungen' ? `${pathname}?tab=rechnungen` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const openBooking = useCallback(
    (id: string) => {
      router.replace(`${pathname}?id=${id}`, { scroll: false });
    },
    [router, pathname],
  );

  const closeBooking = useCallback(() => {
    router.replace(tab === 'rechnungen' ? `${pathname}?tab=rechnungen` : pathname, { scroll: false });
  }, [router, pathname, tab]);

  // ?id= of a booking that is not in the list (deleted or beyond the loaded page)
  const warnedMissing = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedId || loading || selectedBooking) return;
    if (warnedMissing.current === selectedId) return;
    warnedMissing.current = selectedId;
    toast.error(tr('contracts.buchungNichtGefunden'), tr('contracts.derLinkVerweistAuf'));
    router.replace(pathname, { scroll: false });
  }, [selectedId, selectedBooking, loading, toast, router, pathname]);

  // ?tab=rechnungen&invoice=<id>: scroll to and highlight the invoice
  useEffect(() => {
    if (tab !== 'rechnungen' || !invoiceParam || loading) return;
    setInvoiceFilter('all');
    const timer = window.setTimeout(() => document.getElementById(`invoice-${invoiceParam}`)?.scrollIntoView({ block: 'center' }), 50);
    return () => window.clearTimeout(timer);
  }, [tab, invoiceParam, loading, invoices.length]);

  // ?newInvoice=...: open the dialog once the bookings are there, then drop the parameters from the URL.
  const handledNewInvoice = useRef<string | null>(null);
  useEffect(() => {
    const kind = newInvoiceParam ? NEW_INVOICE_KINDS.get(newInvoiceParam) : undefined;
    if (!kind || loading) return;
    const key = `${newInvoiceParam}:${newInvoiceBookingId ?? ''}`;
    if (handledNewInvoice.current === key) return;
    handledNewInvoice.current = key;
    if (canEdit) {
      const booking = newInvoiceBookingId ? (bookings.find((b) => b.id === newInvoiceBookingId) ?? null) : null;
      if (newInvoiceBookingId && !booking) toast.error(tr('contracts.buchungNichtGefunden'), tr('contracts.derLinkVerweistAuf'));
      setInvoiceError(null);
      setInvoiceDialog({ open: true, booking, kind, autoDamages: kind === 'DAMAGE' });
    }
    router.replace(`${pathname}?tab=rechnungen`, { scroll: false });
  }, [newInvoiceParam, newInvoiceBookingId, loading, bookings, canEdit, router, pathname, toast]);

  // ── Actions ───────────────────────────────────────────────────

  const patchBooking = (id: string, patch: Partial<Booking>) => setBookings((rows) => rows.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const downloadContract = useCallback(
    async (b: Booking) => {
      setBusyId(b.id);
      try {
        triggerBlobDownload(await api.downloadContract(b.id), contractFilename(b.id));
      } catch (err) {
        toast.error(tr('common.vertragKonnteNichtHeruntergela'), errorText(err));
      } finally {
        setBusyId(null);
      }
    },
    [toast],
  );

  async function handleSign(signatureDataUrl: string) {
    if (!signing) return;
    setSigningLoading(true);
    try {
      await api.finalizeContract(signing.id, { signature: signatureDataUrl, customerEmail: signing.customerEmail || undefined });
      toast.success(tr('common.vertragSigniert'), signing.customerEmail ? tr('common.derVertragWurdePer') : tr('contracts.vertragVonGespeichert', { customerName: signing.customerName }));
      setSigning(null);
      void load(true);
      refreshCounts();
    } catch (err) {
      toast.error(tr('common.vertragKonnteNichtSigniert'), errorText(err));
    } finally {
      setSigningLoading(false);
    }
  }

  async function handleSaveEmail(email: string) {
    if (!emailBooking) return;
    setEmailSaving(true);
    setEmailError(null);
    try {
      await api.updateBooking(emailBooking.id, { customerEmail: email });
      patchBooking(emailBooking.id, { customerEmail: email });
      toast.success(tr('contracts.eMailGespeichert'), `${emailBooking.customerName}: ${email}`);
      setEmailBooking(null);
    } catch (err) {
      setEmailError(errorText(err, tr('contracts.eMailKonnteNicht')));
    } finally {
      setEmailSaving(false);
    }
  }

  const transition = useCallback(
    async (b: Booking, status: 'active' | 'completed' | 'cancelled') => {
      if (status === 'cancelled') {
        // Replaces window.confirm(): the dialog stays open with the error if the API refuses.
        const done = await confirm({
          title: tr('contracts.buchungStornieren'),
          description: tr('contracts.dasFahrzeugWirdFuer', { customerName: b.customerName, vehicleOf: vehicleOf(b), date: fmtDate(b.startDate), date2: fmtDate(b.endDate) }),
          warning: tr('contracts.dasStornierenKannNicht'),
          confirmLabel: tr('contracts.buchungStornieren2'),
          cancelLabel: tr('contracts.behalten'),
          icon: <CircleX size={20} />,
          onConfirm: async () => {
            const updated = await api.transitionBookingStatus(b.id, status);
            patchBooking(b.id, { status: updated.status });
          },
        });
        if (done) {
          toast.success(tr('contracts.buchungStorniert'), b.customerName);
          refreshCounts();
        }
        return;
      }
      setBusyId(b.id);
      try {
        const updated = await api.transitionBookingStatus(b.id, status);
        patchBooking(b.id, { status: updated.status });
        toast.success(status === 'active' ? tr('contracts.alsAbgeholtMarkiert') : tr('contracts.alsZurueckgegebenMarkiert'), `${b.customerName}, ${vehicleOf(b)}`);
      } catch (err) {
        toast.error(tr('contracts.statusKonnteNichtGeaendert'), errorText(err));
      } finally {
        setBusyId(null);
      }
    },
    [confirm, toast, refreshCounts],
  );

  const downloadInvoice = useCallback(
    async (inv: Invoice) => {
      setBusyId(inv.id);
      try {
        triggerBlobDownload(await api.downloadInvoice(inv.id), invoiceFilename(inv.invoiceNumber));
      } catch (err) {
        toast.error(tr('contracts.rechnungKonnteNichtHeruntergel'), errorText(err));
      } finally {
        setBusyId(null);
      }
    },
    [toast],
  );

  const downloadInvoiceQr = useCallback(
    async (inv: Invoice) => {
      setBusyId(inv.id);
      try {
        triggerBlobDownload(await api.downloadInvoice(inv.id, { qr: true }), invoiceFilename(`${inv.invoiceNumber}-QR`));
      } catch (err) {
        const qr = qrBillError(err);
        if (qr) {
          toast({
            tone: 'error',
            title: tr('invoiceEditor.qrUnavailableTitle'),
            description: qr.missing.length > 0 ? tr('invoiceEditor.qrUnavailableText', { list: qrMissingListText(qr.missing) }) : errorText(err),
            action: { label: tr('invoiceEditor.openInvoiceSettings'), onClick: () => router.push('/settings#invoice-h') },
          });
        } else {
          toast.error(tr('invoiceEditor.qrDownloadFailed'), errorText(err));
        }
      } finally {
        setBusyId(null);
      }
    },
    [toast, router],
  );

  const toggleInvoice = useCallback(
    async (inv: Invoice) => {
      const next = inv.status === 'PENDING' ? 'PAID' : 'PENDING';
      setBusyId(inv.id);
      try {
        await api.toggleInvoiceStatus(inv.id, next);
        setInvoices((rows) => rows.map((r) => (r.id === inv.id ? { ...r, status: next, isOverdue: next === 'PAID' ? false : r.isOverdue } : r)));
        toast.success(next === 'PAID' ? tr('contracts.alsBezahltMarkiert') : tr('contracts.alsOffenMarkiert'), tr('contracts.rechnung', { invoiceNumber: inv.invoiceNumber }));
        void load(true);
        refreshCounts();
      } catch (err) {
        toast.error(tr('contracts.statusKonnteNichtGeaendert'), errorText(err));
      } finally {
        setBusyId(null);
      }
    },
    [toast, load, refreshCounts],
  );

  async function handleCreateInvoice(request: CreateInvoiceRequest) {
    setInvoiceCreating(true);
    setInvoiceError(null);
    try {
      const invoice = await api.createInvoice(request);
      let downloaded = true;
      try {
        triggerBlobDownload(await api.downloadInvoice(invoice.id), invoiceFilename(invoice.invoiceNumber));
      } catch {
        downloaded = false;
      }
      setInvoiceDialog({ open: false, booking: null });
      const mailRequested = request.sendEmail === true;
      const description = downloaded ? tr('contracts.diePDFDateiWurde', { invoiceNumber: invoice.invoiceNumber }) : tr('contracts.derDownloadIstFehlgeschlagen', { invoiceNumber: invoice.invoiceNumber });
      toast.success(tr('contracts.rechnungErstellt'), description);
      if (mailRequested && invoice.emailSent) {
        toast.success(tr('invoiceEditor.mailSent'), tr('invoiceEditor.mailSentText', { invoiceNumber: invoice.invoiceNumber, email: invoice.customerEmail ?? '' }));
      } else if (mailRequested && invoice.emailError === 'no_recipient') {
        toast.error(tr('invoiceEditor.mailNoRecipient'), tr('invoiceEditor.mailNoRecipientText', { invoiceNumber: invoice.invoiceNumber }));
      } else if (mailRequested && invoice.emailError === 'send_failed') {
        toast.error(tr('invoiceEditor.mailFailed'), tr('invoiceEditor.mailFailedText', { invoiceNumber: invoice.invoiceNumber }));
      }
      await load(true);
      refreshCounts();
    } catch (err) {
      const qr = qrBillError(err);
      setInvoiceError(
        qr
          ? { text: qr.missing.length > 0 ? tr('invoiceEditor.qrUnavailable') : qr.message || tr('invoiceEditor.qrUnavailable'), qrMissing: qr.missing.length > 0 ? qr.missing : [] }
          : { text: errorText(err, tr('contracts.rechnungKonnteNichtErstellt')) },
      );
    } finally {
      setInvoiceCreating(false);
    }
  }

  async function handleDunning(data: { penalty: number; notes: string; sendEmail: boolean }) {
    if (!dunningInvoice) return;
    setDunningSending(true);
    setDunningError(null);
    try {
      const created = await api.reissueInvoice(dunningInvoice.id, {
        penalty: data.penalty,
        notes: data.notes || undefined,
        sendEmail: data.sendEmail,
      });
      let downloaded = true;
      try {
        triggerBlobDownload(await api.downloadInvoice(created.id), invoiceFilename(created.invoiceNumber));
      } catch {
        downloaded = false;
      }
      const original = dunningInvoice;
      setDunningInvoice(null);
      if (data.sendEmail && created.emailSent) {
        toast.success(tr('contracts.mahnungGesendet'), `${created.invoiceNumber} an ${original.customerEmail ?? tr('contracts.denKunden')}${downloaded ? tr('contracts.pDFHeruntergeladen') : ''}.`);
      } else if (data.sendEmail && created.emailError === 'send_failed') {
        toast({ tone: 'error', title: tr('contracts.mahnungErstelltEMail'), description: tr('contracts.derVersandIstFehlgeschlagen', { invoiceNumber: created.invoiceNumber }) });
      } else if (data.sendEmail && created.emailError === 'no_recipient') {
        toast({ tone: 'error', title: tr('contracts.mahnungErstelltEMail'), description: tr('contracts.fuerDieRechnungIst', { invoiceNumber: created.invoiceNumber }) });
      } else {
        toast.success(tr('contracts.mahnungErstellt'), `${created.invoiceNumber}${downloaded ? tr('contracts.pDFHeruntergeladen') : ''}.`);
      }
      await load(true);
      refreshCounts();
    } catch (err) {
      setDunningError(errorText(err, tr('contracts.mahnungKonnteNichtErstellt')));
    } finally {
      setDunningSending(false);
    }
  }

  const actions: ContractActions = {
    canEdit,
    openBooking,
    downloadContract: (b) => void downloadContract(b),
    signOnDevice: (b) => router.push(`/contracts/${b.id}/sign`),
    quickSign: (b) => setSigning(b),
    editEmail: (b) => {
      setEmailError(null);
      setEmailBooking(b);
    },
    editBooking: (b) => setEditingBooking(b),
    transition: (b, status) => void transition(b, status),
    createInvoice: (b) => {
      setInvoiceError(null);
      setInvoiceDialog({ open: true, booking: b });
    },
    downloadInvoice: (inv) => void downloadInvoice(inv),
    downloadInvoiceQr: (inv) => void downloadInvoiceQr(inv),
    toggleInvoice: (inv) => void toggleInvoice(inv),
    dunning: (inv) => {
      setDunningError(null);
      setDunningInvoice(inv);
    },
    busyId,
  };

  // ── Render ────────────────────────────────────────────────────

  const tabs = [
    { id: 'buchungen', label: t('common.buchungen'), count: bookings.length },
    { id: 'rechnungen', label: t('common.rechnungen'), count: invoices.length },
  ];

  const statusOptions: { value: BookingStatusFilter; label: string; count: number }[] = [
    { value: 'all', label: t('common.alle'), count: statusCounts.all },
    { value: 'reserved', label: t('common.reserviert'), count: statusCounts.reserved },
    { value: 'active', label: t('common.aktiv'), count: statusCounts.active },
    { value: 'completed', label: t('common.erledigt'), count: statusCounts.completed },
    { value: 'cancelled', label: t('contracts.storniert'), count: statusCounts.cancelled },
  ];
  const contractOptions: { value: ContractFilter; label: string; count: number }[] = [
    { value: 'all', label: t('contracts.alleVertraege'), count: contractCounts.all },
    { value: 'pending', label: t('contracts.ausstehend'), count: contractCounts.pending },
    { value: 'signed', label: t('common.signiert'), count: contractCounts.signed },
  ];
  const invoiceOptions: { value: InvoiceFilter; label: string; count: number }[] = [
    { value: 'all', label: t('common.alle'), count: invoiceCounts.all },
    { value: 'open', label: t('common.offen'), count: invoiceCounts.open },
    { value: 'overdue', label: t('contracts.ueberfaellig'), count: invoiceCounts.overdue },
    { value: 'paid', label: t('common.bezahlt'), count: invoiceCounts.paid },
  ];

  const invoiceTypeOptions: { value: InvoiceTypeFilter; label: string; count: number }[] = [
    { value: 'all', label: t('invoiceEditor.allTypes'), count: invoiceTypeCounts.all },
    { value: 'RENTAL', label: t('invoiceEditor.kinds.RENTAL'), count: invoiceTypeCounts.RENTAL },
    { value: 'DAMAGE', label: t('invoiceEditor.kinds.DAMAGE'), count: invoiceTypeCounts.DAMAGE },
    { value: 'FINE', label: t('invoiceEditor.kinds.FINE'), count: invoiceTypeCounts.FINE },
    { value: 'OTHER', label: t('invoiceEditor.kinds.OTHER'), count: invoiceTypeCounts.OTHER },
  ];

  const searchField = (label: string, placeholder = t('contracts.suchen')) => (
    <div className="relative min-w-[220px] max-w-[360px] flex-1 max-md:min-w-0 max-md:max-w-none">
      <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-graphite" />
      <Input type="search" aria-label={label} placeholder={placeholder} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
    </div>
  );

  const errorBlock = loadError ? (
    <Alert
      tone="err"
      title={t('contracts.buchungenKonntenNichtGeladen')}
      action={
        <Button variant="outline" size="sm" onClick={() => void load()}>
          {t('common.erneutVersuchen')}
        </Button>
      }
    >
      {loadError}
    </Alert>
  ) : null;

  const noMatches = (reset: () => void) => (
    <EmptyState
      compact
      tone="neutral"
      icon={<FileSignature size={32} />}
      title={t('contracts.keineEintraegeGefunden')}
      text={t('contracts.mitDenGewaehltenFiltern')}
      actions={
        <Button variant="ghost" onClick={reset}>
          {t('contracts.filterZuruecksetzen')}
        </Button>
      }
    />
  );

  const bookingsView =
    loading ? (
      isTabletUp ? (
        <Table aria-label={t('contracts.buchungenWerdenGeladen')} className="relative">
          <TBody>
            <SkeletonTableRows rows={6} columns={6} />
          </TBody>
        </Table>
      ) : (
        <SkeletonRows rows={3} />
      )
    ) : bookings.length === 0 ? (
      <EmptyState
        icon={<FileSignature size={32} />}
        title={t('contracts.nochKeineBuchungen')}
        text={t('contracts.buchungenEntstehenAusAnfragen')}
        actions={newBooking.canCreate ? <Button onClick={() => newBooking.open()}>{t('common.neueBuchung')}</Button> : undefined}
      />
    ) : filteredBookings.length === 0 ? (
      noMatches(() => {
        setStatusFilter('all');
        setContractFilter('all');
        setSearch('');
      })
    ) : isTabletUp ? (
      <Table aria-label={t('common.buchungen')} className={cn('relative', compactTable && '[&_td]:px-3 [&_th]:px-3')}>
        <THead>
          <Tr>
            <Th>{t('common.kunde')}</Th>
            <Th>{t('contracts.fahrzeugUndZeitraum')}</Th>
            <Th>{t('common.status')}</Th>
            {showProgress && <Th>{t('contracts.fortschritt')}</Th>}
            <Th align="right">{t('contracts.betrag')}</Th>
            <Th align="right">
              <span className="sr-only">{t('common.aktionen')}</span>
            </Th>
          </Tr>
        </THead>
        <TBody>
          {filteredBookings.map((b) => {
            const progress = bookingProgress(b, invoicesByBooking.get(b.id) ?? []);
            return (
              <Tr key={b.id} selected={b.id === selectedId} onClick={() => openBooking(b.id)} className={cn(b.status === 'cancelled' && 'text-graphite')}>
                <Td>
                  <Cell2
                    primary={
                      <button type="button" onClick={(e) => { e.stopPropagation(); openBooking(b.id); }} className="text-left font-semibold hover:underline">
                        {b.customerName}
                      </button>
                    }
                    secondary={b.customerEmail || tt('contracts.keineEMailHinterlegt')}
                  />
                </Td>
                <Td>
                  <Cell2 primary={vehicleOf(b)} secondary={<span className="num">{periodText(b)}</span>} />
                </Td>
                <Td>
                  <StatusPill kind="booking" status={b.status} />
                </Td>
                {showProgress && (
                  <Td>
                    <ProgressSteps
                      compact
                      steps={progress.steps}
                      aria-label={t('contracts.fortschritt2', { next: progress.next })}
                      className={cn('flex-nowrap', !progressLabels && '[&_.prog-step>span:nth-child(2)]:sr-only [&_.prog-dot]:h-6 [&_.prog-dot]:w-6')}
                    />
                  </Td>
                )}
                <Td align="right" className="num whitespace-nowrap text-base">
                  <b>{priceText(b, businessCurrency)}</b>
                </Td>
                <Td onClick={(e) => e.stopPropagation()}>
                  <div className="acts">
                    <BookingRowActions booking={b} actions={actions} compact={compactTable} />
                  </div>
                </Td>
              </Tr>
            );
          })}
        </TBody>
      </Table>
    ) : (
      <div className="flex flex-col gap-3">
        {filteredBookings.map((b) => (
          <BookingCard key={b.id} booking={b} invoices={invoicesByBooking.get(b.id) ?? []} actions={actions} currency={businessCurrency} />
        ))}
      </div>
    );

  const invoicesView =
    loading ? (
      <SkeletonRows rows={4} />
    ) : invoicesFailed ? (
      <div className="p-5">
        <Alert
          tone="err"
          title={t('contracts.rechnungenKonntenNichtGeladen')}
          action={
            <Button variant="outline" size="sm" onClick={() => void load()}>
              {t('common.erneutVersuchen')}
            </Button>
          }
        >
          {t('contracts.dieVerbindungZumServer')}
        </Alert>
      </div>
    ) : invoices.length === 0 ? (
      <EmptyState
        icon={<Receipt size={32} />}
        title={t('contracts.nochKeineRechnungen')}
        text={t('contracts.rechnungenErstellenSieAus')}
        actions={canEdit ? <Button onClick={() => actions.createInvoice(null)}>{t('common.rechnungErstellen')}</Button> : undefined}
      />
    ) : filteredInvoices.length === 0 ? (
      noMatches(() => {
        setInvoiceFilter('all');
        setInvoiceTypeFilter('all');
        setSearch('');
      })
    ) : isTabletUp ? (
      <Table aria-label={t('common.rechnungen')} className="relative">
        <THead>
          <Tr>
            <Th>{t('contracts.nummer')}</Th>
            <Th>{t('invoiceEditor.colType')}</Th>
            <Th>{t('common.kunde')}</Th>
            <Th>{t('contracts.faelligAm')}</Th>
            <Th>{t('common.status')}</Th>
            <Th align="right">{t('contracts.betrag')}</Th>
            <Th align="right">
              <span className="sr-only">{t('common.aktionen')}</span>
            </Th>
          </Tr>
        </THead>
        <TBody>
          {filteredInvoices.map((inv) => {
            const state = invoiceState(inv);
            return (
              <Tr key={inv.id} id={`invoice-${inv.id}`} selected={inv.id === invoiceParam}>
                <Td className="num">
                  <span className="flex flex-wrap items-center gap-2">
                    <b>{inv.invoiceNumber}</b>
                    {inv.parentInvoiceId && <span className="st s-amber st-plain !h-[22px] !text-xs">{t('common.mahnung')}</span>}
                  </span>
                </Td>
                <Td>
                  <InvoiceTypeCell invoice={inv} />
                </Td>
                <Td>{inv.customerName ?? inv.booking?.customerName ?? '–'}</Td>
                <Td className="num whitespace-nowrap">{fmtDate(inv.dueDate)}</Td>
                <Td>
                  <StatusPill kind="invoice" status={state} />
                </Td>
                <Td align="right" className="num whitespace-nowrap text-base">
                  <b>{fmtMoney(inv.total, { currency: inv.currency })}</b>
                </Td>
                <Td>
                  <div className="acts items-center">
                    <IconButton aria-label={t('contracts.rechnungAlsPDFHerunterladen', { invoiceNumber: inv.invoiceNumber })} className="pr" disabled={busyId === inv.id} onClick={() => actions.downloadInvoice(inv)}>
                      <Download size={20} aria-hidden="true" />
                    </IconButton>
                    <IconButton aria-label={t('invoiceEditor.downloadQr', { invoiceNumber: inv.invoiceNumber })} className="pr" disabled={busyId === inv.id} onClick={() => actions.downloadInvoiceQr(inv)}>
                      <QrCode size={20} aria-hidden="true" />
                    </IconButton>
                    {canEdit && state === 'OVERDUE' && (
                      <Button variant="ghost" size="sm" onClick={() => actions.dunning(inv)}>
                        {t('common.mahnungSenden')}
                      </Button>
                    )}
                    {canEdit && state === 'PENDING' && (
                      <Button variant="ghost" size="sm" disabled={busyId === inv.id} onClick={() => actions.toggleInvoice(inv)}>
                        {t('contracts.alsBezahltMarkieren')}
                      </Button>
                    )}
                    {canEdit && state === 'PAID' && (
                      <Button variant="ghost" size="sm" disabled={busyId === inv.id} onClick={() => actions.toggleInvoice(inv)}>
                        {t('contracts.alsOffenMarkieren')}
                      </Button>
                    )}
                    <Menu items={invoiceMenu(inv, actions)} label={t('contracts.weitereAktionenFuerRechnung', { invoiceNumber: inv.invoiceNumber })} />
                  </div>
                </Td>
              </Tr>
            );
          })}
        </TBody>
      </Table>
    ) : (
      <div className="flex flex-col gap-3">
        {filteredInvoices.map((inv) => (
          <InvoiceCard key={inv.id} invoice={inv} actions={actions} highlighted={inv.id === invoiceParam} />
        ))}
      </div>
    );

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <DrawerLayout className="lg:-m-8">
        <div className="flex min-w-0 flex-col gap-5 md:gap-6 lg:p-8">
          <div className="max-md:hidden">
            <PageHeader
              title={t('contracts.vertraegeUndRechnungen')}
              subtitle={t('contracts.vonDerReservierungBis')}
              tabs={<Tabs aria-label={t('contracts.ansicht')} tabs={tabs} value={tab} onChange={goTab} />}
              tabsInline
            />
          </div>
          <h1 className="sr-only md:hidden">{t('contracts.vertraegeUndRechnungen')}</h1>
          {!isTabletUp && (
            <Tabs aria-label={t('contracts.ansicht')} tabs={tabs} value={tab} onChange={goTab} className="w-full [&>.tab]:flex-1 [&>.tab]:justify-center" />
          )}

          {errorBlock}

          {tab === 'buchungen' ? (
            <>
              {isTabletUp ? (
                <Panel aria-labelledby="bookings-heading" className="overflow-hidden">
                  <div className="panel-h">
                    <h2 className="h2" id="bookings-heading">
                      {t('common.buchungen')}
                    </h2>
                    <ChipGroup aria-label={t('contracts.statusFiltern')} options={statusOptions} value={statusFilter} onChange={setStatusFilter} />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line-soft px-5 py-3">
                    {searchField(t('contracts.buchungSuchenNameE'), t('contracts.buchungSuchen'))}
                    <ChipGroup aria-label={t('contracts.vertragFiltern')} options={contractOptions} value={contractFilter} onChange={setContractFilter} />
                  </div>
                  {bookingsView}
                </Panel>
              ) : (
                <>
                  <ChipGroup aria-label={t('contracts.statusFiltern')} scrollable options={statusOptions} value={statusFilter} onChange={setStatusFilter} className="-mx-4 px-4" />
                  <ChipGroup aria-label={t('contracts.vertragFiltern')} scrollable options={contractOptions} value={contractFilter} onChange={setContractFilter} className="-mx-4 px-4" />
                  {searchField(t('contracts.buchungSuchen2'), t('contracts.buchungSuchen'))}
                  {bookingsView}
                </>
              )}
            </>
          ) : isTabletUp ? (
            <Panel aria-labelledby="invoices-heading" className="overflow-hidden">
              <div className="panel-h">
                <h2 className="h2" id="invoices-heading">
                  {t('common.rechnungen')}
                </h2>
                {canEdit && (
                  <Button variant="ghost" size="sm" iconLeft={<Plus size={16} aria-hidden="true" />} onClick={() => actions.createInvoice(null)}>
                    {t('common.rechnungErstellen')}
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line-soft px-5 py-3">
                {searchField(t('contracts.rechnungSuchenNummerOder'), t('contracts.rechnungSuchen'))}
                <ChipGroup aria-label={t('contracts.rechnungenFiltern')} options={invoiceOptions} value={invoiceFilter} onChange={setInvoiceFilter} />
                <ChipGroup aria-label={t('invoiceEditor.filterType')} options={invoiceTypeOptions} value={invoiceTypeFilter} onChange={setInvoiceTypeFilter} />
              </div>
              {invoicesView}
            </Panel>
          ) : (
            <>
              <ChipGroup aria-label={t('contracts.rechnungenFiltern')} scrollable options={invoiceOptions} value={invoiceFilter} onChange={setInvoiceFilter} className="-mx-4 px-4" />
              <ChipGroup aria-label={t('invoiceEditor.filterType')} scrollable options={invoiceTypeOptions} value={invoiceTypeFilter} onChange={setInvoiceTypeFilter} className="-mx-4 px-4" />
              {searchField(t('contracts.rechnungSuchen2'), t('contracts.rechnungSuchen'))}
              {canEdit && (
                <Button variant="outline" iconLeft={<Plus size={18} aria-hidden="true" />} onClick={() => actions.createInvoice(null)}>
                  {t('common.rechnungErstellen')}
                </Button>
              )}
              {invoicesView}
            </>
          )}
        </div>

        {tab === 'buchungen' && (
          <BookingDetail
            booking={selectedBooking}
            invoices={selectedBooking ? (invoicesByBooking.get(selectedBooking.id) ?? []) : []}
            invoicesLoading={loading}
            actions={actions}
            onClose={closeBooking}
          />
        )}
      </DrawerLayout>

      {signing && (
        <SignaturePad customerName={signing.customerName} loading={signingLoading} onConfirm={handleSign} onCancel={() => setSigning(null)} />
      )}

      <BookingEditModal
        booking={editingBooking}
        onClose={() => setEditingBooking(null)}
        onSaved={(updated) => {
          patchBooking(updated.id, updated as unknown as Partial<Booking>);
          toast.success(tr('bookingEdit.saved'), updated.customerName);
          setEditingBooking(null);
          void load(true);
        }}
      />
      <EmailModal booking={emailBooking} saving={emailSaving} error={emailError} onClose={() => setEmailBooking(null)} onSave={(email) => void handleSaveEmail(email)} />
      <CreateInvoiceModal
        open={invoiceDialog.open}
        booking={invoiceDialog.booking}
        initialKind={invoiceDialog.kind}
        autoAddDamages={invoiceDialog.autoDamages}
        bookings={bookings}
        creating={invoiceCreating}
        error={invoiceError}
        onClose={() => setInvoiceDialog({ open: false, booking: null })}
        onCreate={(request) => void handleCreateInvoice(request)}
      />
      <DunningModal invoice={dunningInvoice} sending={dunningSending} error={dunningError} onClose={() => setDunningInvoice(null)} onSend={(data) => void handleDunning(data)} />
    </div>
  );
}

// ─── Menus and row actions ──────────────────────────────────────

function bookingMenu(b: Booking, a: ContractActions): MenuItem[] {
  const items: MenuItem[] = [{ key: 'open', label: tr('contracts.detailsAnsehen'), icon: <Eye size={18} />, onSelect: () => a.openBooking(b.id) }];
  if (b.contractStatus === 'SIGNED') {
    items.push({ key: 'pdf', label: tr('contracts.vertragAlsPDFHerunterladen'), icon: <Download size={18} />, onSelect: () => a.downloadContract(b) });
  }
  if (!a.canEdit) return items;
  const cancelled = b.status === 'cancelled';
  if (b.contractStatus !== 'SIGNED' && !cancelled) {
    items.push({ key: 'device', label: tr('common.aufGeraetUnterschreiben'), icon: <Tablet size={18} />, onSelect: () => a.signOnDevice(b) });
    items.push({ key: 'quick', label: tr('common.schnellUnterschreiben'), icon: <PenTool size={18} />, onSelect: () => a.quickSign(b) });
  }
  items.push({ key: 'email', label: b.customerEmail ? tr('contracts.eMailAendern') : tr('common.eMailHinzufuegen'), icon: <Mail size={18} />, onSelect: () => a.editEmail(b) });
  if (b.status === 'reserved') items.push({ key: 'pickup', label: tr('contracts.alsAbgeholtMarkieren'), icon: <CircleCheck size={18} />, onSelect: () => a.transition(b, 'active') });
  if (b.status === 'active') items.push({ key: 'return', label: tr('contracts.alsZurueckgegebenMarkieren'), icon: <Wrench size={18} />, onSelect: () => a.transition(b, 'completed') });
  if (canInvoice(b)) items.push({ key: 'invoice', label: tr('common.rechnungErstellen'), icon: <Receipt size={18} />, onSelect: () => a.createInvoice(b) });
  if (b.status === 'reserved' || b.status === 'active') {
    items.push({ key: 'cancel', label: tr('contracts.stornieren'), icon: <CircleX size={18} />, danger: true, separatorBefore: true, onSelect: () => a.transition(b, 'cancelled') });
  }
  return items;
}

function invoiceMenu(inv: Invoice, a: ContractActions): MenuItem[] {
  const state = invoiceState(inv);
  const items: MenuItem[] = [
    { key: 'pdf', label: tr('contracts.alsPDFHerunterladen'), icon: <Download size={18} />, onSelect: () => a.downloadInvoice(inv) },
    { key: 'qr', label: tr('invoiceEditor.downloadQrMenu'), icon: <QrCode size={18} />, onSelect: () => a.downloadInvoiceQr(inv) },
  ];
  const bookingId = inv.bookingId;
  if (bookingId) items.push({ key: 'booking', label: tr('common.zurBuchung'), icon: <Eye size={18} />, onSelect: () => a.openBooking(bookingId) });
  if (inv.type === 'FINE' && inv.items?.some((i) => i.fineId)) {
    const fineId = inv.items.find((i) => i.fineId)?.fineId;
    if (fineId) items.push({ key: 'fine', label: tr('invoiceEditor.toFine'), icon: <Receipt size={18} />, href: `/fines?id=${fineId}` });
  }
  if (a.canEdit) {
    items.push({ key: 'toggle', label: state === 'PAID' ? tr('contracts.alsOffenMarkieren') : tr('contracts.alsBezahltMarkieren'), icon: <CircleCheck size={18} />, onSelect: () => a.toggleInvoice(inv) });
    if (state !== 'PAID') items.push({ key: 'dunning', label: tr('common.mahnungSenden'), icon: <RefreshCw size={18} />, onSelect: () => a.dunning(inv) });
  }
  return items;
}

function BookingRowActions({ booking: b, actions: a, compact = false }: { booking: Booking; actions: ContractActions; compact?: boolean }) {
  const t = useTranslations();
  const signed = b.contractStatus === 'SIGNED';
  return (
    <>
      {signed && (
        <IconButton aria-label={t('contracts.vertragVonAlsPDF', { customerName: b.customerName })} className="pr" disabled={a.busyId === b.id} onClick={() => a.downloadContract(b)}>
          <Download size={20} aria-hidden="true" />
        </IconButton>
      )}
      {!signed && b.status !== 'cancelled' && a.canEdit && !compact && (
        <>
          <IconButton aria-label={t('contracts.aufGeraetUnterschreiben', { customerName: b.customerName })} className="pr" onClick={() => a.signOnDevice(b)}>
            <Tablet size={20} aria-hidden="true" />
          </IconButton>
          <IconButton aria-label={t('contracts.schnellUnterschreiben', { customerName: b.customerName })} className="pr" onClick={() => a.quickSign(b)}>
            <PenTool size={20} aria-hidden="true" />
          </IconButton>
        </>
      )}
      <Menu items={bookingMenu(b, a)} label={t('contracts.weitereAktionenFuer', { customerName: b.customerName })} />
    </>
  );
}

// ─── Mobile cards ───────────────────────────────────────────────

function BookingCard({ booking: b, invoices, actions: a, currency }: { booking: Booking; invoices: Invoice[]; actions: ContractActions; currency: string }) {
  const t = useTranslations();
  const progress = bookingProgress(b, invoices);
  const unpaid = invoices.filter((i) => i.status === 'PENDING');
  const signed = b.contractStatus === 'SIGNED';

  // The primary action is whatever the booking needs next.
  let primary: { label: string; run: () => void } | null = null;
  if (a.canEdit) {
    if (progress.nextAction === 'sign') primary = { label: t('common.aufGeraetUnterschreiben'), run: () => a.signOnDevice(b) };
    else if (progress.nextAction === 'invoice') primary = { label: t('common.rechnungErstellen'), run: () => a.createInvoice(b) };
    else if (progress.nextAction === 'pay') {
      primary = unpaid.length === 1 ? { label: t('contracts.alsBezahltMarkieren'), run: () => a.toggleInvoice(unpaid[0]) } : { label: t('contracts.rechnungenAnsehen'), run: () => a.openBooking(b.id) };
    }
  }
  if (!primary) primary = { label: t('contracts.details'), run: () => a.openBooking(b.id) };

  return (
    <MobileCard
      title={<span className="text-base">{b.customerName}</span>}
      subtitle={vehicleOf(b)}
      status={<StatusPill kind="booking" status={b.status} />}
      onOpen={() => a.openBooking(b.id)}
      actions={
        <>
          <Button variant="outline" className="min-w-0 flex-1" onClick={primary.run}>
            {primary.label}
          </Button>
          {signed && (
            <IconButton aria-label={t('contracts.vertragVonHerunterladen', { customerName: b.customerName })} variant="outline" disabled={a.busyId === b.id} onClick={() => a.downloadContract(b)}>
              <Download size={20} aria-hidden="true" />
            </IconButton>
          )}
          <Menu
            items={bookingMenu(b, a)}
            label={t('contracts.weitereAktionenFuer', { customerName: b.customerName })}
            trigger={(p) => (
              <IconButton {...p} aria-label={t('contracts.weitereAktionenFuer', { customerName: b.customerName })} variant="outline">
                <DotsIcon />
              </IconButton>
            )}
          />
        </>
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="num mut">{periodText(b)}</span>
        <b className="num text-lg">{priceText(b, currency)}</b>
      </div>
      <ProgressSteps
        compact
        steps={progress.steps}
        aria-label={t('contracts.fortschritt2', { next: progress.next })}
        className="[&_.prog-step>span:nth-child(2)]:sr-only [&_.prog-dot]:h-6 [&_.prog-dot]:w-6"
      />
      <div className="sm">
        <b>{t('contracts.alsNaechstes')}</b> {progress.next}
      </div>
    </MobileCard>
  );
}

/** Invoice type badge + number of lines + QR badge. */
function InvoiceTypeCell({ invoice: inv }: { invoice: Invoice }) {
  const t = useTranslations();
  const type = invoiceTypeOf(inv);
  const itemCount = inv.items?.length ?? 0;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <StatusPill tone={type === 'RENTAL' ? 'gray' : type === 'DAMAGE' ? 'amber' : type === 'FINE' ? 'red' : 'blue'} plain label={t(`invoiceEditor.kinds.${type}`)} />
      {itemCount > 0 && <span className="sm mut">{t('invoiceEditor.itemCount', { count: itemCount })}</span>}
      {inv.withQrBill && <StatusPill tone="vio" plain label={t('invoiceEditor.qrBadge')} />}
    </span>
  );
}

function DotsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 12h.01M19 12h.01M5 12h.01" />
    </svg>
  );
}

function InvoiceCard({ invoice: inv, actions: a, highlighted }: { invoice: Invoice; actions: ContractActions; highlighted: boolean }) {
  const tt = useTranslations();
  const t = useTranslations();
  const state = invoiceState(inv);
  return (
    <div id={`invoice-${inv.id}`}>
      <MobileCard
        className={cn(highlighted && 'border-ink')}
        title={<span className="num text-base">{inv.invoiceNumber}</span>}
        subtitle={inv.customerName ?? inv.booking?.customerName}
        status={<StatusPill kind="invoice" status={state} />}
        actions={
          <>
            {a.canEdit && state === 'OVERDUE' && (
              <Button variant="outline" className="min-w-0 flex-1" onClick={() => a.dunning(inv)}>
                {t('common.mahnungSenden')}
              </Button>
            )}
            {a.canEdit && state !== 'OVERDUE' && (
              <Button variant="outline" className="min-w-0 flex-1" disabled={a.busyId === inv.id} onClick={() => a.toggleInvoice(inv)}>
                {state === 'PAID' ? tt('contracts.alsOffenMarkieren') : tt('contracts.alsBezahltMarkieren')}
              </Button>
            )}
            <IconButton aria-label={t('contracts.rechnungHerunterladen', { invoiceNumber: inv.invoiceNumber })} variant="outline" disabled={a.busyId === inv.id} onClick={() => a.downloadInvoice(inv)}>
              <Download size={20} aria-hidden="true" />
            </IconButton>
            <IconButton aria-label={t('invoiceEditor.downloadQr', { invoiceNumber: inv.invoiceNumber })} variant="outline" disabled={a.busyId === inv.id} onClick={() => a.downloadInvoiceQr(inv)}>
              <QrCode size={20} aria-hidden="true" />
            </IconButton>
            <Menu
              items={invoiceMenu(inv, a)}
              label={t('contracts.weitereAktionenFuerRechnung', { invoiceNumber: inv.invoiceNumber })}
              trigger={(p) => (
                <IconButton {...p} aria-label={t('contracts.weitereAktionenFuerRechnung', { invoiceNumber: inv.invoiceNumber })} variant="outline">
                  <DotsIcon />
                </IconButton>
              )}
            />
          </>
        }
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="sm mut">
            {t.rich('contracts.dueOn', { date: fmtDate(inv.dueDate), num: (chunks) => <span className="num">{chunks}</span> })}
            {inv.parentInvoiceId && ` · ${t('common.mahnung')}`}
          </span>
          <b className="num text-lg">{fmtMoney(inv.total, { currency: inv.currency })}</b>
        </div>
        <InvoiceTypeCell invoice={inv} />
      </MobileCard>
    </div>
  );
}
