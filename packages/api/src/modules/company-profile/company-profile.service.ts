import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateCompanyProfileDto } from './dto/update-company-profile.dto';

/**
 * CompanyProfile is a singleton (one active row). It carries the who-we-are /
 * contact / bank details printed on every price-offer PDF. The bank box is
 * money-security-sensitive, so:
 *   - writes are gated by `company_profile.manage` (controller),
 *   - IBAN format + the TODO bank-name sentinel are rejected on write so the
 *     RVd-2 send-gate can never be satisfied with junk,
 *   - every change to a bank-sensitive field appends a CompanyProfileHistory
 *     row (append-only audit — DOC-1 / blocker #7).
 *
 * Mirrors the PricingPolicy singleton pattern (getOrCreate + update).
 */

/** Bank-sensitive fields. Any change to these is audited per-field. */
const AUDITED_FIELDS = [
  'bankName',
  'bankAccountName',
  'iban',
  'swift',
] as const;
type AuditedField = (typeof AUDITED_FIELDS)[number];

@Injectable()
export class CompanyProfileService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The active profile. The org seed ships exactly one (id
   * `company_profile_default`); if it's somehow missing we create a minimal
   * placeholder so reads/sends behave deterministically. We pick the oldest
   * active row — the same selection the send-gate uses.
   */
  async getOrCreate() {
    let row = await this.prisma.companyProfile.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!row) {
      row = await this.prisma.companyProfile.create({
        data: {
          legalName: 'ABAK Engineering Consultancy',
          bankName: 'TODO — set via Company Profile settings',
          iban: 'SA0000000000000000000000',
        },
      });
    }
    return row;
  }

  /** Read for rendering / the settings page. */
  async get() {
    return this.getOrCreate();
  }

  /**
   * Validate a Saudi IBAN being written. Rejects empty, the SA0000… all-zero
   * placeholder, and anything not in the SA + 22-digit (24-char total) shape.
   * IBANs are stored without spaces; we strip whitespace before checking.
   */
  private assertValidIban(raw: string): string {
    const iban = raw.replace(/\s+/g, '').toUpperCase();
    if (!/^SA[0-9]{22}$/.test(iban)) {
      throw new BadRequestException(
        'Invalid IBAN — a Saudi IBAN must be "SA" followed by 22 digits (24 characters total)',
      );
    }
    if (/^SA0+$/.test(iban)) {
      throw new BadRequestException(
        'Invalid IBAN — the SA0000… placeholder cannot be saved',
      );
    }
    return iban;
  }

  /** Reject the TODO sentinel so a junk bank name can't be persisted. */
  private assertValidBankName(name: string): string {
    const trimmed = name.trim();
    if (trimmed === '' || /todo/i.test(trimmed)) {
      throw new BadRequestException(
        'Invalid bank name — set the real bank name (the TODO placeholder is not allowed)',
      );
    }
    return trimmed;
  }

  /**
   * Update the singleton. Applies only the fields present on the DTO. Validates
   * bank-sensitive writes, then appends a CompanyProfileHistory row for every
   * audited field whose value actually changed.
   */
  async update(dto: UpdateCompanyProfileDto, actorId?: string) {
    const existing = await this.getOrCreate();

    const data: Prisma.CompanyProfileUpdateInput = {};

    // Validate bank-sensitive fields up front so an invalid IBAN / bank name
    // aborts the whole write (no partial save).
    if (dto.iban !== undefined) data.iban = this.assertValidIban(dto.iban);
    if (dto.bankName !== undefined)
      data.bankName = this.assertValidBankName(dto.bankName);
    if (dto.bankAccountName !== undefined)
      data.bankAccountName = dto.bankAccountName;
    if (dto.swift !== undefined) data.swift = dto.swift;

    // Non-sensitive fields — applied as-is.
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.legalName !== undefined) data.legalName = dto.legalName;
    if (dto.legalNameAr !== undefined) data.legalNameAr = dto.legalNameAr;
    if (dto.aboutText !== undefined) data.aboutText = dto.aboutText;
    if (dto.aboutTextAr !== undefined) data.aboutTextAr = dto.aboutTextAr;
    if (dto.services !== undefined)
      data.services = dto.services as unknown as Prisma.InputJsonValue;
    if (dto.accreditations !== undefined)
      data.accreditations =
        dto.accreditations as unknown as Prisma.InputJsonValue;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.website !== undefined) data.website = dto.website;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.addressAr !== undefined) data.addressAr = dto.addressAr;
    if (dto.logoUrl !== undefined) data.logoUrl = dto.logoUrl;

    // Compute the audit deltas BEFORE the write, using the validated values.
    const auditRows: Prisma.CompanyProfileHistoryCreateManyInput[] = [];
    for (const field of AUDITED_FIELDS) {
      if (!(field in data)) continue;
      const newValue = (data[field] as string | undefined) ?? null;
      const oldValue =
        (existing[field as AuditedField] as string | null) ?? null;
      if (newValue === oldValue) continue;
      auditRows.push({
        profileId: existing.id,
        field,
        oldValue,
        newValue,
        changedById: actorId ?? null,
      });
    }

    // Persist the update + audit rows atomically so the trail never diverges
    // from the stored value.
    const [updated] = await this.prisma.$transaction([
      this.prisma.companyProfile.update({
        where: { id: existing.id },
        data,
      }),
      ...(auditRows.length
        ? [this.prisma.companyProfileHistory.createMany({ data: auditRows })]
        : []),
    ]);

    return updated;
  }

  /** The append-only bank-change audit trail (newest first). */
  async history() {
    const profile = await this.getOrCreate();
    return this.prisma.companyProfileHistory.findMany({
      where: { profileId: profile.id },
      orderBy: { changedAt: 'desc' },
    });
  }
}
