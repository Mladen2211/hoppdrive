'use client';

import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Cell2,
  Drawer,
  DrawerLayout,
  EmptyState,
  Field,
  IconButton,
  Input,
  MobileCard,
  Panel,
  SkeletonRows,
  SkeletonTableRows,
  StatusPill,
  Switch,
  Table,
  TBody,
  Td,
  Textarea,
  Th,
  THead,
  Tr,
  useConfirm,
  useToast,
} from '@/components/ui';
import { ContentHeader } from '@/components/content/ContentHeader';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useCan } from '@/hooks/usePermission';
import { api } from '@/lib/api';
import { orUserError } from '@/lib/content-errors';
import { errorText } from '@/lib/errors';
import { useTranslations } from 'next-intl';
import { tr } from '@/i18n/active';

interface Location {
  id: string;
  name: string;
  address: string;
  zip: string;
  city: string;
  country: string;
  phone: string | null;
  email: string | null;
  openingHours?: string | null;
  isActive: boolean;
  _count?: { bookings: number };
}

interface FormState {
  name: string;
  phone: string;
  address: string;
  zip: string;
  city: string;
  country: string;
  email: string;
  openingHours: string;
  isActive: boolean;
}

const EMPTY: FormState = {
  name: '',
  phone: '',
  address: '',
  zip: '',
  city: '',
  country: 'CH',
  email: '',
  openingHours: '',
  isActive: true,
};

const toForm = (loc: Location): FormState => ({
  name: loc.name,
  phone: loc.phone || '',
  address: loc.address,
  zip: loc.zip,
  city: loc.city,
  country: loc.country || 'CH',
  email: loc.email || '',
  openingHours: loc.openingHours || '',
  isActive: loc.isActive,
});

const sameForm = (a: FormState, b: FormState) => (Object.keys(a) as (keyof FormState)[]).every((k) => a[k] === b[k]);

const NEW_KEY = '__new__';

export default function LocationsPage() {
  return (
    <Suspense fallback={<SkeletonRows rows={4} />}>
      <LocationsView />
    </Suspense>
  );
}

function VisibilityPill({ active }: { active: boolean }) {
  const t = useTranslations();
  return active ? <StatusPill tone="green" label={t('common.sichtbar')} /> : <StatusPill tone="gray" label={t('common.ausgeblendet')} />;
}

function LocationsView() {
  const tt = useTranslations();
  const t = useTranslations();
  const { token } = useAdminAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const canEdit = useCan('content', 'edit');

  const selectedId = searchParams.get('id');

  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState<Partial<Record<keyof FormState, boolean>>>({});
  const [saving, setSaving] = useState(false);

  const selected = useMemo(
    () => (selectedId ? (locations.find((l) => l.id === selectedId) ?? null) : null),
    [locations, selectedId],
  );
  const open = creating || selected !== null;
  const base = creating ? EMPTY : selected ? toForm(selected) : EMPTY;
  const dirty = open && !sameForm(form, base);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setLocations(await api.getLocations());
    } catch (err) {
      setLoadError(errorText(err, tr('locations.standorteKonntenNichtGeladen')));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  // Load the form when another location (or "new") is opened, not when the list refreshes.
  const formFor = useRef<string | null>(null);
  useEffect(() => {
    const key = creating ? NEW_KEY : selected?.id ?? null;
    if (key === formFor.current) return;
    formFor.current = key;
    if (creating) setForm(EMPTY);
    else if (selected) setForm(toForm(selected));
    setError('');
    setInvalid({});
  }, [creating, selected]);

  const setSelection = useCallback(
    (id: string | null) => {
      router.replace(id ? `${pathname}?id=${encodeURIComponent(id)}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  async function confirmDiscard(): Promise<boolean> {
    if (!dirty) return true;
    return confirm({
      title: tr('common.aenderungenVerwerfen'),
      description: tr('locations.ihreAenderungenAmStandort'),
      confirmLabel: tr('common.verwerfen'),
      cancelLabel: tr('common.weiterBearbeiten'),
    });
  }

  async function openLocation(loc: Location) {
    if (selected?.id === loc.id && !creating) return;
    if (!(await confirmDiscard())) return;
    setCreating(false);
    setSelection(loc.id);
  }

  async function startCreate() {
    if (!(await confirmDiscard())) return;
    formFor.current = null; // force a fresh form even when "new" is already open
    setCreating(true);
    setSelection(null);
  }

  async function closeEditor() {
    if (!(await confirmDiscard())) return;
    setCreating(false);
    setSelection(null);
    formFor.current = null;
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setInvalid((i) => ({ ...i, [key]: false }));
  }

  async function handleSave() {
    const missing: typeof invalid = {
      name: !form.name.trim(),
      address: !form.address.trim(),
      zip: !form.zip.trim(),
      city: !form.city.trim(),
    };
    if (Object.values(missing).some(Boolean)) {
      setInvalid(missing);
      setError(tr('locations.requiredText'));
      return;
    }
    setSaving(true);
    setError('');
    const payload = {
      ...form,
      name: form.name.trim(),
      address: form.address.trim(),
      zip: form.zip.trim(),
      city: form.city.trim(),
    };
    try {
      if (creating) {
        const created = await api.createLocation(payload);
        await load();
        formFor.current = created.id;
        setForm(payload);
        setCreating(false);
        setSelection(created.id);
        toast.success(tr('locations.standortHinzugefuegt'));
      } else if (selected) {
        await api.updateLocation(selected.id, payload);
        await load();
        setForm(payload);
        toast.success(tr('locations.standortGespeichert'));
      }
    } catch (err) {
      setError(errorText(err, tr('locations.fehlerBeimSpeichern')));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(loc: Location) {
    const bookings = loc._count?.bookings ?? 0;
    const ok = await confirm({
      title: tr('locations.standortLoeschen', { name: loc.name }),
      description: tr('locations.derStandortVerschwindetVon'),
      warning:
        bookings > 0 ? (
          <>{tr.rich('locations.deleteWarning', { count: bookings, b: (chunks) => <b>{chunks}</b> })}</>
        ) : undefined,
      confirmLabel: tr('locations.standortLoeschen2'),
      icon: <Trash2 size={20} />,
      onConfirm: () => orUserError(api.deleteLocation(loc.id), tr('locations.derStandortKonnteNicht')),
    });
    if (!ok) return;
    setCreating(false);
    formFor.current = null;
    setSelection(null);
    await load();
    toast.success(tr('locations.standortGeloescht'));
  }

  const addButton = canEdit ? (
    <Button size="sm" onClick={() => void startCreate()} disabled={creating} iconLeft={<Plus size={18} aria-hidden="true" />}>
      {t('locations.standortHinzufuegen')}
    </Button>
  ) : null;

  const addressLine = (loc: Location) => `${loc.address}, ${loc.zip} ${loc.city}`;
  const bookingsText = (loc: Location) => {
    const n = loc._count?.bookings ?? 0;
    return `${n} ${t('locations.buchungN', { count: n })}`;
  };

  const editorTitle = creating ? t('locations.neuerStandort') : t('locations.standortBearbeiten');

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <DrawerLayout className="lg:-m-8">
        <div className="flex min-w-0 flex-col gap-5 md:gap-6 lg:p-8">
          <ContentHeader active="locations" ownCount={loading || loadError ? null : locations.length} />

          {loadError && (
            <Alert
              tone="err"
              title={t('locations.standorteKonntenNichtGeladen')}
              action={
                <Button variant="outline" size="sm" onClick={() => void load()}>
                  {t('common.erneutVersuchen')}
                </Button>
              }
            >
              {loadError}
            </Alert>
          )}

          <Panel aria-labelledby="locations-h" className="overflow-hidden">
            <div className="panel-h">
              <h2 className="h2" id="locations-h">
                {t('common.standorte')}
              </h2>
              {addButton}
            </div>

            {loading ? (
              <>
                <div className="max-md:hidden">
                  <Table aria-label={t('locations.standorteWerdenGeladen')}>
                    <TBody>
                      <SkeletonTableRows rows={3} columns={4} />
                    </TBody>
                  </Table>
                </div>
                <div className="p-4 md:hidden">
                  <SkeletonRows rows={3} avatar={false} />
                </div>
              </>
            ) : locations.length === 0 && !loadError ? (
              <EmptyState
                icon={<MapPin size={32} />}
                title={t('locations.nochKeinStandort')}
                text={t('locations.standorteErscheinenAufDer')}
                actions={addButton}
              />
            ) : (
              <>
                <div className="max-md:hidden">
                  <Table aria-label={t('common.standorte')}>
                    <THead>
                      <Tr>
                        <Th>{t('common.name')}</Th>
                        <Th>{t('locations.adresse')}</Th>
                        <Th>{t('common.buchungen')}</Th>
                        <Th>{t('common.website')}</Th>
                        <Th align="right">
                          <span className="sr-only">{t('locations.oeffnen')}</span>
                        </Th>
                      </Tr>
                    </THead>
                    <TBody>
                      {locations.map((loc) => (
                        <Tr key={loc.id} selected={!creating && loc.id === selectedId} onClick={() => void openLocation(loc)}>
                          <Td>
                            <Cell2 primary={loc.name} secondary={loc.phone || undefined} />
                          </Td>
                          <Td>{addressLine(loc)}</Td>
                          <Td className="num">{loc._count?.bookings ?? 0}</Td>
                          <Td>
                            <VisibilityPill active={loc.isActive} />
                          </Td>
                          <Td>
                            <div className="acts">
                              <IconButton
                                className="pr"
                                aria-label={t('locations.standortBearbeiten2', { name: loc.name })}
                                aria-current={loc.id === selectedId ? 'true' : undefined}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void openLocation(loc);
                                }}
                              >
                                <Pencil size={20} aria-hidden="true" />
                              </IconButton>
                            </div>
                          </Td>
                        </Tr>
                      ))}
                    </TBody>
                  </Table>
                </div>

                <div className="flex flex-col gap-3 p-4 md:hidden">
                  {locations.map((loc) => (
                    <MobileCard
                      key={loc.id}
                      title={loc.name}
                      subtitle={bookingsText(loc)}
                      status={<VisibilityPill active={loc.isActive} />}
                      onOpen={() => void openLocation(loc)}
                      actions={
                        <Button variant="outline" fullWidth onClick={() => void openLocation(loc)} aria-label={t('locations.standortBearbeiten2', { name: loc.name })}>
                          {canEdit ? tt('locations.bearbeiten') : tt('locations.ansehen')}
                        </Button>
                      }
                    >
                      <div>{addressLine(loc)}</div>
                      {loc.phone && <div className="mut">{loc.phone}</div>}
                    </MobileCard>
                  ))}
                </div>
              </>
            )}
          </Panel>

          <p className="sm mut">
            {t.rich('locations.mapHint', {
              link: (chunks) => (
                <Link href="/settings" className="font-semibold text-ruby-dark underline underline-offset-2">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </div>

        <Drawer
          open={open}
          onClose={() => void closeEditor()}
          title={editorTitle}
          subtitle={
            creating ? (
              <span className="sm">{t('locations.wirdNachDemSpeichern')}</span>
            ) : selected ? (
              <VisibilityPill active={form.isActive} />
            ) : undefined
          }
          footer={
            canEdit ? (
              <>
                <Button loading={saving} onClick={() => void handleSave()}>
                  {t('common.speichern')}
                </Button>
                <Button variant="ghost" disabled={saving} onClick={() => void closeEditor()}>
                  {t('common.abbrechen')}
                </Button>
                {selected && !creating && (
                  <Button
                    variant="ghost"
                    disabled={saving}
                    onClick={() => void handleDelete(selected)}
                    iconLeft={<Trash2 size={16} aria-hidden="true" />}
                    className="ml-auto border-edge-err text-err"
                  >
                    {t('common.loeschen')}
                  </Button>
                )}
              </>
            ) : undefined
          }
        >
          {open && (
            <>
              {!canEdit && <Alert tone="info">{t('locations.mitIhrerRolleKoennen')}</Alert>}
              {error && <Alert tone="err">{error}</Alert>}

              {/* Map preview placeholder (the live map is configured in the website settings) */}
              <div
                role="img"
                aria-label={t('locations.kartenvorschau')}
                className="relative h-[150px] flex-none overflow-hidden rounded-12 border border-line bg-map"
              >
                <span aria-hidden="true" className="absolute inset-y-0 left-1/2 w-0.5 bg-map-road" />
                <span aria-hidden="true" className="absolute inset-x-0 top-[60%] h-[3px] bg-map-road" />
                <span aria-hidden="true" className="absolute left-[46%] top-[34%] flex h-[34px] w-[34px] -rotate-45 items-center justify-center rounded-[50%_50%_50%_0] bg-ruby">
                  <span className="h-3 w-3 rounded-full bg-card" />
                </span>
              </div>

              <fieldset disabled={!canEdit} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
                <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                  <Field label={t('common.name')} required>
                    <Input value={form.name} invalid={invalid.name} onChange={(e) => set('name', e.target.value)} data-autofocus />
                  </Field>
                  <Field label={t('common.telefon')}>
                    <Input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} autoComplete="off" />
                  </Field>
                </div>
                <Field label={t('locations.strasseUndNr')} required>
                  <Input value={form.address} invalid={invalid.address} onChange={(e) => set('address', e.target.value)} />
                </Field>
                <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-4">
                  <Field label={t('locations.pLZ')} required>
                    <Input value={form.zip} invalid={invalid.zip} onChange={(e) => set('zip', e.target.value)} inputMode="numeric" />
                  </Field>
                  <Field label={t('locations.ort')} required>
                    <Input value={form.city} invalid={invalid.city} onChange={(e) => set('city', e.target.value)} />
                  </Field>
                </div>
                <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-4">
                  <Field label={t('locations.land')}>
                    <Input value={form.country} onChange={(e) => set('country', e.target.value)} maxLength={2} />
                  </Field>
                  <Field label={t('common.eMail')}>
                    <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
                  </Field>
                </div>
                <Field label={t('locations.oeffnungszeiten')} hint={t('locations.eineZeileProEintrag')}>
                  <Textarea
                    rows={3}
                    value={form.openingHours}
                    onChange={(e) => set('openingHours', e.target.value)}
                    placeholder={t('locations.moFr0800')}
                  />
                </Field>
                <Switch
                  checked={form.isActive}
                  onChange={(v) => set('isActive', v)}
                  label={t('locations.aufDerWebsiteSichtbar')}
                  description={t('locations.ausgeblendeteStandorteBleibenF')}
                />
              </fieldset>
            </>
          )}
        </Drawer>
      </DrawerLayout>
    </div>
  );
}
