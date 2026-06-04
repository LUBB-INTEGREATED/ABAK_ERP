import {
  PrismaClient,
  QuoteSectionBinding,
  QuoteSectionType,
} from '@prisma/client';

// DOC-1: seed the default 8-block price-offer template + the org CompanyProfile
// so EVERY quote (incl. legacy) renders. Idempotent — safe to re-run.

export const DEFAULT_TEMPLATE_ID = 'tmpl_default_8block';
export const DEFAULT_PROFILE_ID = 'company_profile_default';

// The canonical 8 blocks, in order (cover → about → scope/pricing → payment →
// methodology → timeline → requirements/notes → thank-you). SCOPE_PRICING /
// METHODOLOGY / TIMELINE fan out per department section at render time.
export const DEFAULT_BLOCKS: {
  sectionType: QuoteSectionType;
  bindingType: QuoteSectionBinding;
}[] = [
  { sectionType: 'COVER', bindingType: 'DATA_BOUND' },
  { sectionType: 'ABOUT', bindingType: 'STATIC_CONTENT' },
  { sectionType: 'SCOPE_PRICING', bindingType: 'DATA_BOUND' },
  { sectionType: 'PAYMENT', bindingType: 'DATA_BOUND' },
  { sectionType: 'METHODOLOGY', bindingType: 'DATA_BOUND' },
  { sectionType: 'TIMELINE', bindingType: 'DATA_BOUND' },
  { sectionType: 'REQUIREMENTS_NOTES', bindingType: 'DATA_BOUND' },
  { sectionType: 'THANKYOU', bindingType: 'STATIC_CONTENT' },
];

export async function seedPriceOfferDefaults(prisma: PrismaClient) {
  // --- CompanyProfile singleton (about/services/contact + placeholder bank) ---
  await prisma.companyProfile.upsert({
    where: { id: DEFAULT_PROFILE_ID },
    update: {},
    create: {
      id: DEFAULT_PROFILE_ID,
      isActive: true,
      legalName: 'ABAK Engineering Consultancy',
      legalNameAr: 'أباك للاستشارات الهندسية',
      aboutText:
        'ABAK Engineering Consultancy delivers integrated architectural, ' +
        'structural, MEP, supervision and safety services across the Kingdom, ' +
        'pairing licensed engineers with disciplined project governance.',
      aboutTextAr:
        'تقدّم أباك للاستشارات الهندسية خدمات معمارية وإنشائية وكهروميكانيكية ' +
        'وإشرافية وخدمات سلامة متكاملة في أنحاء المملكة، بكوادر هندسية مرخّصة ' +
        'وحوكمة مشاريع منضبطة.',
      services: [
        { name: 'Architectural Design', nameAr: 'التصميم المعماري' },
        { name: 'Structural Engineering', nameAr: 'الهندسة الإنشائية' },
        { name: 'MEP Engineering', nameAr: 'الهندسة الكهروميكانيكية' },
        { name: 'Construction Supervision', nameAr: 'الإشراف على التنفيذ' },
        {
          name: 'Safety & Industrial Security',
          nameAr: 'السلامة والأمن الصناعي',
        },
        { name: 'Surveying', nameAr: 'المساحة' },
      ],
      accreditations: [
        {
          name: 'Saudi Council of Engineers',
          nameAr: 'الهيئة السعودية للمهندسين',
        },
      ],
      phone: '+966 11 000 0000',
      email: 'info@abak.com.sa',
      website: 'www.abak.com.sa',
      address: 'Riyadh, Kingdom of Saudi Arabia',
      addressAr: 'الرياض، المملكة العربية السعودية',
      // Placeholder bank — real values entered via the Company Profile settings
      // page (EPIC 5) behind company_profile.manage + history audit.
      bankName: 'TODO — set via Company Profile settings',
      bankAccountName: 'ABAK Engineering Consultancy',
      iban: 'SA0000000000000000000000',
      swift: null,
    },
  });

  // --- Default 8-block template ---
  await prisma.quoteTemplate.upsert({
    where: { id: DEFAULT_TEMPLATE_ID },
    update: { isDefault: true, isActive: true },
    create: {
      id: DEFAULT_TEMPLATE_ID,
      name: 'Default 8-block price offer',
      isDefault: true,
      isActive: true,
      version: 1,
      publishedAt: new Date(),
    },
  });

  // Re-create the section set deterministically (idempotent).
  await prisma.quoteTemplateSection.deleteMany({
    where: { templateId: DEFAULT_TEMPLATE_ID },
  });
  await prisma.quoteTemplateSection.createMany({
    data: DEFAULT_BLOCKS.map((b, i) => ({
      templateId: DEFAULT_TEMPLATE_ID,
      sectionType: b.sectionType,
      bindingType: b.bindingType,
      position: i,
      enabled: true,
    })),
  });
}

// Allow standalone execution: `node --env-file=.env -r ... prisma/seed-price-offer.ts`
if (require.main === module) {
  const prisma = new PrismaClient();
  seedPriceOfferDefaults(prisma)
    .then(() => console.log('Price-offer defaults seeded.'))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
