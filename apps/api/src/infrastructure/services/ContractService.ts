import type { PrismaClient } from '@prisma/client';
import { AppError } from '../../application/errors';
import { damageLine, type DamageLike } from './damageText';
import type { ContractData, PdfService } from './PdfService';
import type { ContractFillInput, ContractTemplateService } from './ContractTemplateService';
import type { PrivateStorageService } from './PrivateStorageService';
import type { SettingsService } from './SettingsService';

export interface CompanySigner {
  adminId: string | null;
  name: string | null;
  signatureData: string | null;
}

/** Address lines of the driver for the contract (street / zip + city / country). */
export function driverAddressLines(b: {
  driverStreet: string | null;
  driverZip: string | null;
  driverCity: string | null;
  driverCountry: string | null;
}): string[] {
  return [b.driverStreet, [b.driverZip, b.driverCity].filter(Boolean).join(' '), b.driverCountry].filter(
    (l): l is string => !!l && l.trim() !== '',
  );
}

type BookingForContract = {
  id: string;
  vehicleId: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  driverStreet: string | null;
  driverZip: string | null;
  driverCity: string | null;
  driverCountry: string | null;
  driverBirthDate: Date | null;
  driverLicenseNumber: string | null;
  driverLicenseCountry: string | null;
  startDate: Date;
  endDate: Date;
  totalPrice: unknown;
  discountAmount: unknown;
  currency: string;
  notes: string | null;
  signatureData: string | null;
  signedAt: Date | null;
  contractTemplateId?: string | null;
  vehicle: { brand: string; model: string; year: number; licensePlate: string | null };
  location?: { name: string } | null;
};

export interface RenderOptions {
  signer: CompanySigner;
  /** PNG data URL of the renter; omit for the draft. */
  customerSignatureData?: string | null;
  signedAt?: Date | null;
  /** 'active' (default) = the active template, a template id = that template, null = the built-in contract. */
  template?: 'active' | string | null;
}

/**
 * Renders rental contracts: the pre-filled draft (signed by the company only) and the final contract (both signatures),
 * from the active fillable template or, without one, the built-in layout. Also resolves who signs for the company.
 */
export class ContractService {
  constructor(
    private prisma: PrismaClient,
    private settings: SettingsService,
    private pdf: PdfService,
    private templates: ContractTemplateService,
    private storage: PrivateStorageService,
  ) {}

  /**
   * Who signs for the company: the booking's recorded signer, else the admin of the `contract.signerAdminId` setting,
   * else the acting admin. The signature may be missing: see requireSigner.
   */
  async resolveSigner(actingAdminId: string | undefined, bookingSignerId?: string | null): Promise<CompanySigner> {
    const configured = await this.settings.getContractSignerId();
    // The first of the three that is still an active admin signs. (A configured / recorded admin that was deleted is
    // skipped instead of blocking every contract.) A missing signature of that admin is reported by requireSigner.
    const candidates = [bookingSignerId, configured, actingAdminId].filter((id, i, all): id is string => !!id && all.indexOf(id) === i);
    for (const id of candidates) {
      const admin = await this.prisma.admin.findFirst({ where: { id, deletedAt: null }, select: { id: true, name: true, signatureData: true } });
      if (admin) return { adminId: admin.id, name: admin.name, signatureData: admin.signatureData ?? null };
    }
    return { adminId: null, name: null, signatureData: null };
  }

  /** resolveSigner, but 422 `company_signature_missing` when the signer has no signature on file. */
  async requireSigner(actingAdminId: string | undefined, bookingSignerId?: string | null): Promise<CompanySigner> {
    const signer = await this.resolveSigner(actingAdminId, bookingSignerId);
    if (!signer.signatureData) {
      const who = signer.name ? `von ${signer.name} ` : '';
      throw new AppError(
        `Für die Vertragsunterzeichnung der Vermieterin fehlt die Unterschrift ${who}(Mein Konto → Unterschrift). ` +
          'Bitte eine Unterschrift hinterlegen oder in den Einstellungen unter Dokumente einen anderen Unterzeichner wählen.',
        422,
        'company_signature_missing',
        { signer: { id: signer.adminId, name: signer.name } },
      );
    }
    return signer;
  }

  /** OPEN damages of the vehicle in display order (oldest first). */
  async openDamages(vehicleId: string): Promise<(DamageLike & { id: string })[]> {
    return this.prisma.vehicleDamage.findMany({
      where: { vehicleId, status: 'OPEN' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, view: true, zone: true, type: true, severity: true, description: true, createdAt: true },
    });
  }

  async activeTemplate() {
    return this.prisma.contractTemplate.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'desc' } });
  }

  /** What the fill engine prints about a booking. */
  async fillInputFor(
    booking: BookingForContract,
    options: { signer: CompanySigner; customerSignatureData?: string | null; signedAt?: Date | null },
  ): Promise<ContractFillInput> {
    return {
      bookingId: booking.id,
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      customerPhone: booking.customerPhone,
      driverAddressLines: driverAddressLines(booking),
      driverBirthDate: booking.driverBirthDate,
      driverLicenseNumber: booking.driverLicenseNumber,
      driverLicenseCountry: booking.driverLicenseCountry,
      vehicleBrand: booking.vehicle.brand,
      vehicleModel: booking.vehicle.model,
      vehicleYear: booking.vehicle.year,
      licensePlate: booking.vehicle.licensePlate,
      startDate: booking.startDate,
      endDate: booking.endDate,
      totalPrice: Number(booking.totalPrice),
      discountAmount: Number(booking.discountAmount ?? 0),
      currency: booking.currency,
      locationName: booking.location?.name ?? null,
      notes: booking.notes,
      existingDamages: await this.openDamages(booking.vehicleId),
      signedAt: options.signedAt ?? null,
      company: await this.settings.getCompany(),
      companySignatureData: options.signer.signatureData,
      customerSignatureData: options.customerSignatureData ?? null,
    };
  }

  /** The contract PDF; templateId tells which template was used (null = built-in layout). */
  async render(booking: BookingForContract, options: RenderOptions): Promise<{ bytes: Uint8Array; templateId: string | null }> {
    const input = await this.fillInputFor(booking, options);
    const template =
      options.template === null
        ? null
        : options.template && options.template !== 'active'
          ? await this.prisma.contractTemplate.findUnique({ where: { id: options.template } })
          : await this.activeTemplate();

    if (template) {
      const bytes = await this.templates.fill(await this.storage.read(template.storageKey), input);
      return { bytes, templateId: template.id };
    }

    const data: ContractData = {
      id: booking.id,
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      customerPhone: booking.customerPhone,
      driverAddressLines: input.driverAddressLines,
      driverBirthDate: booking.driverBirthDate,
      driverLicenseNumber: booking.driverLicenseNumber,
      driverLicenseCountry: booking.driverLicenseCountry,
      vehicleBrand: booking.vehicle.brand,
      vehicleModel: booking.vehicle.model,
      licensePlate: booking.vehicle.licensePlate,
      startDate: booking.startDate,
      endDate: booking.endDate,
      totalPrice: Number(booking.totalPrice),
      discountAmount: Number(booking.discountAmount ?? 0),
      currency: booking.currency,
      signatureData: options.customerSignatureData ?? null,
      signedAt: options.signedAt ?? null,
      notes: booking.notes,
      locationName: booking.location?.name ?? null,
      existingDamages: input.existingDamages.map((d, i) => damageLine(d, i + 1)),
    };
    const bytes = await this.pdf.generateContract(data, {
      company: input.company,
      companySignatureData: options.signer.signatureData,
    });
    return { bytes, templateId: null };
  }
}
