'use client';

/**
 * "Benutzer und Rollen": users table (role pill, last active), invite and edit dialogs, and the
 * read-only "Rechte pro Rolle" matrix rendered from the same PERMISSIONS object the API enforces.
 * On screens from 1280 px the activity log sits to the right, as on the Settings-Users board.
 */
import { Mail, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import {
  ADMIN_ROLES,
  PERMISSIONS,
  PERMISSION_AREAS,
  type AdminRole,
  type AdminUserDto,
} from '@hoppdrive/shared';
import {
  Alert,
  Avatar,
  Button,
  Cell2,
  EmptyState,
  Field,
  IconButton,
  Input,
  MobileCard,
  Modal,
  Panel,
  Select,
  SkeletonRows,
  SkeletonTableRows,
  StatusPill,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  useConfirm,
  useMediaQuery,
  useToast,
} from '@/components/ui';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { api } from '@/lib/api';
import { fieldMessages } from '@/lib/auth-errors';
import { adminErrorText, lastActiveText } from '@/lib/settings-users';
import { ActivityLog } from './ActivityLog';
import { useTranslations } from 'next-intl';
import { tr } from '@/i18n/active';

const ROLE_TONE: Record<AdminRole, 'red' | 'blue' | 'vio' | 'gray'> = {
  ADMIN: 'red',
  RENTAL: 'blue',
  EDITOR: 'vio',
  READONLY: 'gray',
};
const AVATAR_TONE: Record<AdminRole, 'ink' | 'blue' | 'vio' | 'gray'> = {
  ADMIN: 'ink',
  RENTAL: 'blue',
  EDITOR: 'vio',
  READONLY: 'gray',
};

const ROLE_HINT: Record<AdminRole, string> = {
  get ADMIN() { return tr('settings.vollerZugriffInklusiveBenutzer'); },
  get RENTAL() { return tr('settings.anfragenVertraegeKalenderUnd'); },
  get EDITOR() { return tr('settings.inhalteDerWebsiteBearbeiten'); },
  get READONLY() { return tr('settings.allesAnsehenNichtsAendern'); },
};

function RolePill({ user }: { user: AdminUserDto }) {
  // A pending invite shows its future role in amber (board: "Vermietung" amber).
  return <StatusPill kind="role" status={user.role} tone={user.pending ? 'amber' : ROLE_TONE[user.role]} />;
}

export function UsersTab() {
  const t = useTranslations();
  const { admin } = useAdminAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const wide = useMediaQuery('(min-width: 1280px)');

  const [users, setUsers] = useState<AdminUserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<AdminUserDto | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setUsers(await api.getAdmins());
    } catch (err) {
      setLoadError(adminErrorText(err, tr('settings.dieBenutzerKonntenNicht')));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const nameOf = (u: AdminUserDto) => (u.pending ? u.email : u.name || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email);
  const secondaryOf = (u: AdminUserDto) => (u.pending ? (u.inviteExpired ? t('settings.einladungAbgelaufen') : t('settings.einladungVersendet')) : u.email);
  const activeText = (u: AdminUserDto) => (u.pending ? t('settings.ausstehend') : lastActiveText(u.lastActiveAt));

  const usersPanel = (
    <Panel aria-labelledby="users-h" className="overflow-hidden">
      <div className="panel-h">
        <h2 className="h2" id="users-h">
          {t('settings.benutzer')}
        </h2>
        <Button size="sm" onClick={() => setInviting(true)} iconLeft={<Plus size={18} aria-hidden="true" />}>
          {t('settings.benutzerEinladen')}
        </Button>
      </div>

      {loadError && (
        <div className="p-4">
          <Alert
            tone="err"
            title={t('settings.benutzerKonntenNichtGeladen')}
            action={
              <Button variant="outline" size="sm" onClick={() => void load()}>
                {t('common.erneutVersuchen')}
              </Button>
            }
          >
            {loadError}
          </Alert>
        </div>
      )}

      {loading ? (
        <>
          <div className="max-md:hidden">
            <Table aria-label={t('settings.benutzerWerdenGeladen')}>
              <TBody>
                <SkeletonTableRows rows={4} columns={4} />
              </TBody>
            </Table>
          </div>
          <div className="p-4 md:hidden">
            <SkeletonRows rows={3} />
          </div>
        </>
      ) : users.length === 0 && !loadError ? (
        <EmptyState
          icon={<Mail size={32} />}
          title={t('settings.nochKeineBenutzer')}
          text={t('settings.ladenSieIhrTeam')}
        />
      ) : (
        <>
          <div className="max-md:hidden">
            <Table aria-label={t('settings.benutzer')}>
              <THead>
                <Tr>
                  <Th>{t('common.name')}</Th>
                  <Th>{t('settings.rolle')}</Th>
                  <Th>{t('settings.zuletztAktiv')}</Th>
                  <Th align="right">
                    <span className="sr-only">{t('settings.bearbeiten')}</span>
                  </Th>
                </Tr>
              </THead>
              <TBody>
                {users.map((user) => (
                  <Tr key={user.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={user.pending ? '?' : nameOf(user)} initials={user.pending ? '?' : undefined} tone={user.pending ? 'gray' : AVATAR_TONE[user.role]} />
                        <Cell2
                          primary={
                            <>
                              {nameOf(user)}
                              {user.id === admin?.id && <span className="mut font-normal"> {t('settings.sie')}</span>}
                            </>
                          }
                          secondary={secondaryOf(user)}
                        />
                      </div>
                    </Td>
                    <Td>
                      <RolePill user={user} />
                    </Td>
                    <Td className={user.pending ? 'text-graphite' : undefined}>{activeText(user)}</Td>
                    <Td>
                      <div className="acts">
                        <IconButton className="pr" aria-label={t('settings.editUser', { name: nameOf(user) })} onClick={() => setEditing(user)}>
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
            {users.map((user) => (
              <MobileCard
                key={user.id}
                title={
                  <>
                    {nameOf(user)}
                    {user.id === admin?.id && <span className="mut font-normal"> {t('settings.sie')}</span>}
                  </>
                }
                subtitle={secondaryOf(user)}
                status={<RolePill user={user} />}
                actions={
                  <Button variant="outline" fullWidth onClick={() => setEditing(user)} aria-label={t('settings.editUser', { name: nameOf(user) })}>
                    {t('settings.bearbeiten')}
                  </Button>
                }
              >
                <div className="mut">{t('settings.zuletztAktiv2', { activeText: activeText(user) })}</div>
              </MobileCard>
            ))}
          </div>
        </>
      )}
    </Panel>
  );

  const matrix = (
    <Panel aria-labelledby="matrix-h" className="overflow-hidden">
      <div className="panel-h">
        <h2 className="h2" id="matrix-h">
          {t('settings.rechteProRolle')}
        </h2>
        <span className="sm mut">{t('settings.nurAdministratorenKoennenRolle')}</span>
      </div>

      <div className="max-md:hidden">
        <Table aria-label={t('settings.rechteProRolle')}>
          <THead>
            <Tr>
              <Th>{t('settings.bereich')}</Th>
              {ADMIN_ROLES.map((role) => (
                <Th key={role}>{tr(`roles.${role}`)}</Th>
              ))}
            </Tr>
          </THead>
          <TBody>
            {PERMISSION_AREAS.map((area) => (
              <Tr key={area}>
                <Td>
                  <b className="font-semibold">{tr(`areas.${area}`)}</b>
                </Td>
                {ADMIN_ROLES.map((role) => (
                  <Td key={role}>
                    <StatusPill kind="permission" status={PERMISSIONS[area][role]} plain />
                  </Td>
                ))}
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 p-4 md:hidden">
        {PERMISSION_AREAS.map((area) => (
          <MobileCard key={area} title={tr(`areas.${area}`)}>
            <dl className="m-0 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
              {ADMIN_ROLES.map((role) => (
                <div key={role} className="contents">
                  <dt className="mut">{tr(`roles.${role}`)}</dt>
                  <dd className="m-0 justify-self-end">
                    <StatusPill kind="permission" status={PERMISSIONS[area][role]} plain />
                  </dd>
                </div>
              ))}
            </dl>
          </MobileCard>
        ))}
      </div>
    </Panel>
  );

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="flex min-w-0 flex-col gap-6">
        {usersPanel}
        {matrix}
      </div>
      {wide && <ActivityLog />}

      {inviting && (
        <InviteModal
          onClose={() => setInviting(false)}
          onDone={(user, emailSent) => {
            setInviting(false);
            void load();
            if (emailSent) toast.success(tr('settings.einladungGesendet'), tr('settings.erhaeltEineEMail', { email: user.email }));
            else
              toast.error(
                tr('settings.einladungAngelegtEMail'),
                tr('settings.derBenutzerWurdeAngelegt', { email: user.email }),
                { duration: 10000 },
              );
          }}
        />
      )}

      {editing && (
        <EditModal
          user={editing}
          isSelf={editing.id === admin?.id}
          onClose={() => setEditing(null)}
          onChanged={(message) => {
            setEditing(null);
            void load();
            toast.success(message);
          }}
          onResent={(emailSent, email) => {
            setEditing(null);
            void load();
            if (emailSent) toast.success(tr('settings.einladungErneutGesendet'), email);
            else toast.error(tr('settings.eMailNichtGesendet'), tr('settings.bitteVersuchenSieEs'));
          }}
          confirmRemove={async (user) =>
            confirm({
              title: tr('settings.removeUserTitle', { name: nameOf(user) }),
              description: user.pending
                ? tr('settings.dieEinladungWirdZurueckgezogen')
                : tr('settings.derBenutzerKannSich'),
              confirmLabel: tr('settings.benutzerEntfernen'),
              icon: <Trash2 size={20} />,
              onConfirm: async () => {
                try {
                  await api.deleteAdmin(user.id);
                } catch (err) {
                  // 409: own account / last administrator, shown by the dialog in German
                  throw new Error(adminErrorText(err, tr('settings.derBenutzerKonnteNicht')));
                }
              },
            })
          }
        />
      )}
    </div>
  );
}

// ── Invite ────────────────────────────────────────────────────

function InviteModal({ onClose, onDone }: { onClose: () => void; onDone: (user: AdminUserDto, emailSent: boolean) => void }) {
  const t = useTranslations();
  const formId = useId();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminRole>('RENTAL');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = email.trim();
    if (!value || !/^\S+@\S+\.\S+$/.test(value)) {
      setEmailError(tr('common.gebenSieEineGueltige'));
      return;
    }
    setEmailError(null);
    setError(null);
    setSaving(true);
    try {
      const result = await api.inviteAdmin({ email: value, role });
      onDone(result, result.emailSent);
    } catch (err) {
      if (fieldMessages(err, 'email').length > 0) setEmailError(tr('common.gebenSieEineGueltige'));
      else setError(adminErrorText(err, tr('settings.dieEinladungKonnteNicht')));
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!saving}
      title={t('settings.benutzerEinladen')}
      description={t('settings.diePersonErhaeltEine')}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t('common.abbrechen')}
          </Button>
          <Button type="submit" form={formId} loading={saving} iconLeft={<Send size={18} aria-hidden="true" />}>
            {t('settings.einladungSenden')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {error && <Alert tone="err">{error}</Alert>}
        <Field label={t('common.eMail')} error={emailError} required>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} data-autofocus />
        </Field>
        <Field label={t('settings.rolle')} hint={ROLE_HINT[role]}>
          <Select value={role} onChange={(e) => setRole(e.target.value as AdminRole)}>
            {ADMIN_ROLES.map((r) => (
              <option key={r} value={r}>
                {tr(`roles.${r}`)}
              </option>
            ))}
          </Select>
        </Field>
      </form>
    </Modal>
  );
}

// ── Edit ──────────────────────────────────────────────────────

function EditModal({
  user,
  isSelf,
  onClose,
  onChanged,
  onResent,
  confirmRemove,
}: {
  user: AdminUserDto;
  isSelf: boolean;
  onClose: () => void;
  onChanged: (message: string) => void;
  onResent: (emailSent: boolean, email: string) => void;
  confirmRemove: (user: AdminUserDto) => Promise<boolean>;
}) {
  const t = useTranslations();
  const formId = useId();
  const [role, setRole] = useState<AdminRole>(user.role);
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = saving || resending;
  const displayName = user.pending ? user.email : user.name || user.email;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (role === user.role) {
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.updateAdminRole(user.id, role);
      onChanged(tr('settings.rolleVonIstJetzt', { displayName, item: tr(`roles.${role}`) }));
    } catch (err) {
      setError(adminErrorText(err, tr('settings.dieRolleKonnteNicht')));
      setSaving(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setError(null);
    try {
      const result = await api.inviteAdmin({ email: user.email, role });
      onResent(result.emailSent, user.email);
    } catch (err) {
      setError(adminErrorText(err, tr('settings.dieEinladungKonnteNicht')));
      setResending(false);
    }
  }

  async function handleRemove() {
    setError(null);
    // The confirm dialog shows the server's German message itself when removing fails (409).
    const ok = await confirmRemove(user).catch(() => false);
    if (ok) onChanged(user.pending ? tr('settings.einladungZurueckgezogen') : tr('settings.userRemoved', { name: displayName }));
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!busy}
      title={displayName}
      description={user.pending ? (user.inviteExpired ? t('settings.dieEinladungIstAbgelaufen') : t('settings.einladungVersendetNochNicht')) : user.email}
      size="sm"
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => void handleRemove()}
            disabled={busy || isSelf}
            iconLeft={<Trash2 size={16} aria-hidden="true" />}
            className="mr-auto border-edge-err text-err"
          >
            {t('settings.entfernen')}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t('common.abbrechen')}
          </Button>
          <Button type="submit" form={formId} loading={saving} disabled={resending || isSelf}>
            {t('common.speichern')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {error && <Alert tone="err">{error}</Alert>}
        {isSelf && (
          <Alert tone="info">{t('settings.sieKoennenIhreEigene')}</Alert>
        )}
        <Field label={t('settings.rolle')} hint={ROLE_HINT[role]}>
          <Select value={role} onChange={(e) => setRole(e.target.value as AdminRole)} disabled={isSelf || busy} data-autofocus>
            {ADMIN_ROLES.map((r) => (
              <option key={r} value={r}>
                {tr(`roles.${r}`)}
              </option>
            ))}
          </Select>
        </Field>
        {user.pending && (
          <Button variant="outline" onClick={() => void handleResend()} loading={resending} disabled={saving} iconLeft={<Send size={18} aria-hidden="true" />}>
            {t('settings.einladungErneutSenden')}
          </Button>
        )}
      </form>
    </Modal>
  );
}
