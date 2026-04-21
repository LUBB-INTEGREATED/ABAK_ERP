import {
  PrismaClient,
  UserRole,
  UserStatus,
  SettingType,
  LeadChannel,
  LeadStatus,
  LeadPriority,
  SLAStatus,
  ClientClassification,
  ClientStatus,
  InteractionType,
  InteractionDirection,
  FollowUpType,
  FollowUpStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'Password123!';

async function main() {
  console.log('🌱 Seeding database...');

  await prisma.purchaseOrder.deleteMany();
  await prisma.quoteApproval.deleteMany();
  await prisma.paymentMilestone.deleteMany();
  await prisma.quoteItem.deleteMany();
  await prisma.rfq.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.salesTarget.deleteMany();
  await prisma.fieldVisit.deleteMany();
  await prisma.stageTransition.deleteMany();
  await prisma.pipelineEntry.deleteMany();
  await prisma.clientNote.deleteMany();
  await prisma.followUp.deleteMany();
  await prisma.interaction.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.client.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.publicHoliday.deleteMany();
  await prisma.settingHistory.deleteMany();
  await prisma.systemSetting.deleteMany();
  await prisma.service.deleteMany();
  await prisma.serviceCategory.deleteMany();
  await prisma.user.deleteMany();

  console.log('Hashing default password...');
  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  console.log('Creating users...');
  await prisma.user.createMany({
    data: [
      {
        email: 'admin@abak.com',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        phone: '+966501234567',
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        emailVerified: true,
      },
      {
        email: 'manager@abak.com',
        password: hashedPassword,
        firstName: 'Sales',
        lastName: 'Manager',
        phone: '+966501234568',
        role: UserRole.SALES_MANAGER,
        status: UserStatus.ACTIVE,
        emailVerified: true,
      },
      {
        email: 'rep1@abak.com',
        password: hashedPassword,
        firstName: 'Ahmed',
        lastName: 'AlSaleh',
        phone: '+966501234569',
        role: UserRole.SALES_REPRESENTATIVE,
        status: UserStatus.ACTIVE,
        emailVerified: true,
      },
      {
        email: 'rep2@abak.com',
        password: hashedPassword,
        firstName: 'Mohammed',
        lastName: 'AlQahtani',
        phone: '+966501234570',
        role: UserRole.SALES_REPRESENTATIVE,
        status: UserStatus.ACTIVE,
        emailVerified: true,
      },
    ],
  });
  console.log(`✅ Created 4 users (default password: ${DEFAULT_PASSWORD})`);

  console.log('Creating service categories...');
  const design = await prisma.serviceCategory.create({
    data: {
      name: 'Design',
      nameAr: 'التصميم',
      description: 'Architectural, structural, MEP, interior, landscape design',
      icon: 'blueprint',
      order: 1,
    },
  });

  const planning = await prisma.serviceCategory.create({
    data: {
      name: 'Planning',
      nameAr: 'التخطيط والدراسات',
      description: 'Urban planning, feasibility, studies & consultations',
      icon: 'map',
      order: 2,
    },
  });

  const supervision = await prisma.serviceCategory.create({
    data: {
      name: 'Supervision & Management',
      nameAr: 'الإشراف والإدارة',
      description: 'Project supervision, project management, permits',
      icon: 'hard-hat',
      order: 3,
    },
  });
  console.log('✅ Created 3 service categories');

  console.log('Creating services (SRV-01..SRV-11)...');
  const services = await prisma.service.createMany({
    data: [
      {
        categoryId: design.id,
        code: 'SRV-01',
        name: 'Architectural Design',
        nameEn: 'Architectural Design',
        nameAr: 'التصميم المعماري',
        unit: 'per project',
      },
      {
        categoryId: design.id,
        code: 'SRV-02',
        name: 'Structural Design',
        nameEn: 'Structural Design',
        nameAr: 'التصميم الإنشائي',
        unit: 'per project',
      },
      {
        categoryId: design.id,
        code: 'SRV-03',
        name: 'MEP Design',
        nameEn: 'MEP Design',
        nameAr: 'تصميم MEP',
        unit: 'per project',
      },
      {
        categoryId: design.id,
        code: 'SRV-04',
        name: 'Interior Design',
        nameEn: 'Interior Design',
        nameAr: 'التصميم الداخلي',
        unit: 'per project',
      },
      {
        categoryId: design.id,
        code: 'SRV-05',
        name: 'Landscape Design',
        nameEn: 'Landscape Design',
        nameAr: 'تصميم المناظر الطبيعية',
        unit: 'per project',
      },
      {
        categoryId: planning.id,
        code: 'SRV-06',
        name: 'Urban Planning',
        nameEn: 'Urban Planning',
        nameAr: 'التخطيط العمراني',
        unit: 'per project',
      },
      {
        categoryId: supervision.id,
        code: 'SRV-07',
        name: 'Project Supervision',
        nameEn: 'Project Supervision',
        nameAr: 'الإشراف على المشاريع',
        unit: 'per project',
      },
      {
        categoryId: supervision.id,
        code: 'SRV-08',
        name: 'Project Management',
        nameEn: 'Project Management',
        nameAr: 'إدارة المشاريع',
        unit: 'per project',
      },
      {
        categoryId: planning.id,
        code: 'SRV-09',
        name: 'Studies & Consultations',
        nameEn: 'Studies & Consultations',
        nameAr: 'الدراسات والاستشارات',
        unit: 'per engagement',
      },
      {
        categoryId: supervision.id,
        code: 'SRV-10',
        name: 'Municipal & Gov Permits',
        nameEn: 'Municipal & Gov Permits',
        nameAr: 'التراخيص البلدية والحكومية',
        unit: 'per permit',
      },
      {
        categoryId: planning.id,
        code: 'SRV-11',
        name: 'Feasibility Studies',
        nameEn: 'Feasibility Studies',
        nameAr: 'دراسات الجدوى',
        unit: 'per study',
      },
    ],
  });
  console.log(`✅ Created ${services.count} services (SRV-01..SRV-11)`);

  console.log('Creating system settings...');
  await prisma.systemSetting.createMany({
    data: [
      // SLA
      {
        key: 'sla_lead_assignment_hours',
        value: '4',
        defaultValue: '4',
        type: SettingType.NUMBER,
        category: 'sla',
        labelAr: 'مدة تخصيص العميل المحتمل (ساعة)',
        labelEn: 'Lead assignment SLA (hours)',
        descriptionAr: 'المدة القصوى قبل تصعيد عدم تخصيص العميل المحتمل.',
        descriptionEn: 'Maximum time before an unassigned lead is escalated.',
        minValue: 1,
        maxValue: 48,
        editableByRoles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        key: 'sla_first_contact_hours',
        value: '24',
        defaultValue: '24',
        type: SettingType.NUMBER,
        category: 'sla',
        labelAr: 'مدة أول تواصل (ساعة)',
        labelEn: 'First contact SLA (hours)',
        minValue: 1,
        maxValue: 168,
        editableByRoles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        key: 'sla_quote_approval_level1_hours',
        value: '24',
        defaultValue: '24',
        type: SettingType.NUMBER,
        category: 'sla',
        labelAr: 'SLA موافقة العرض - المستوى 1 (ساعة)',
        labelEn: 'Quote approval SLA L1 (hours)',
        minValue: 1,
        editableByRoles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        key: 'sla_quote_approval_level2_hours',
        value: '48',
        defaultValue: '48',
        type: SettingType.NUMBER,
        category: 'sla',
        labelAr: 'SLA موافقة العرض - المستوى 2 (ساعة)',
        labelEn: 'Quote approval SLA L2 (hours)',
        minValue: 1,
        editableByRoles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        key: 'sla_payment_validation_hours',
        value: '24',
        defaultValue: '24',
        type: SettingType.NUMBER,
        category: 'sla',
        labelAr: 'SLA التحقق من الدفع (ساعة)',
        labelEn: 'Payment validation SLA (hours)',
        minValue: 1,
        editableByRoles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        key: 'sla_invoice_auto_issue_hours',
        value: '48',
        defaultValue: '48',
        type: SettingType.NUMBER,
        category: 'sla',
        labelAr: 'إصدار الفاتورة التلقائي (ساعة)',
        labelEn: 'Invoice auto-issue window (hours)',
        minValue: 1,
        editableByRoles: ['SUPER_ADMIN', 'ADMIN'],
      },
      // Pipeline / CRM
      {
        key: 'pipeline_stuck_lead_days',
        value: '14',
        defaultValue: '14',
        type: SettingType.NUMBER,
        category: 'pipeline',
        labelAr: 'أيام العميل المتوقف (يوم)',
        labelEn: 'Stuck lead threshold (days)',
        minValue: 1,
        editableByRoles: ['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER'],
      },
      {
        key: 'crm_dormant_days',
        value: '180',
        defaultValue: '180',
        type: SettingType.NUMBER,
        category: 'crm',
        labelAr: 'أيام خمول العميل (يوم)',
        labelEn: 'Client dormant threshold (days)',
        minValue: 30,
        editableByRoles: ['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER'],
      },
      {
        key: 'crm_followup_overdue_threshold_days',
        value: '3',
        defaultValue: '3',
        type: SettingType.NUMBER,
        category: 'crm',
        labelAr: 'حد تأخر المتابعة (يوم)',
        labelEn: 'Follow-up overdue threshold (days)',
        minValue: 1,
        editableByRoles: ['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER'],
      },
      // Approval thresholds
      {
        key: 'approval_quote_level2_threshold',
        value: '500000',
        defaultValue: '500000',
        type: SettingType.NUMBER,
        category: 'approval',
        labelAr: 'حد موافقة المستوى 2 (ريال)',
        labelEn: 'Level 2 approval threshold (SAR)',
        minValue: 0,
        editableByRoles: ['SUPER_ADMIN', 'ADMIN'],
      },
      // Commission
      {
        key: 'commission_rate_broker_default',
        value: '3',
        defaultValue: '3',
        type: SettingType.NUMBER,
        category: 'commission',
        labelAr: 'نسبة عمولة الوسيط الافتراضية (%)',
        labelEn: 'Default broker commission rate (%)',
        minValue: 0,
        maxValue: 20,
        editableByRoles: ['SUPER_ADMIN', 'FINANCE_MANAGER'],
      },
      {
        key: 'commission_rate_salesrep_default',
        value: '2',
        defaultValue: '2',
        type: SettingType.NUMBER,
        category: 'commission',
        labelAr: 'نسبة عمولة المندوب الافتراضية (%)',
        labelEn: 'Default sales rep commission rate (%)',
        minValue: 0,
        maxValue: 20,
        editableByRoles: ['SUPER_ADMIN', 'FINANCE_MANAGER'],
      },
      // Finance
      {
        key: 'vat_rate_standard',
        value: '15',
        defaultValue: '15',
        type: SettingType.NUMBER,
        category: 'finance',
        labelAr: 'نسبة ضريبة القيمة المضافة (%)',
        labelEn: 'Standard VAT rate (%)',
        minValue: 0,
        maxValue: 30,
        editableByRoles: ['SUPER_ADMIN', 'FINANCE_MANAGER'],
      },
      // Localization
      {
        key: 'default_locale',
        value: 'ar-SA',
        defaultValue: 'ar-SA',
        type: SettingType.STRING,
        category: 'localization',
        labelAr: 'اللغة الافتراضية',
        labelEn: 'Default locale',
        editableByRoles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        key: 'default_calendar_display',
        value: 'BOTH',
        defaultValue: 'BOTH',
        type: SettingType.STRING,
        category: 'localization',
        labelAr: 'عرض التقويم الافتراضي',
        labelEn: 'Default calendar display',
        editableByRoles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        key: 'default_timezone',
        value: 'Asia/Riyadh',
        defaultValue: 'Asia/Riyadh',
        type: SettingType.STRING,
        category: 'localization',
        labelAr: 'المنطقة الزمنية الافتراضية',
        labelEn: 'Default timezone',
        editableByRoles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        key: 'week_start_day',
        value: 'SUNDAY',
        defaultValue: 'SUNDAY',
        type: SettingType.STRING,
        category: 'localization',
        labelAr: 'أول أيام الأسبوع',
        labelEn: 'Week start day',
        editableByRoles: ['SUPER_ADMIN', 'ADMIN'],
      },
      // Notifications
      {
        key: 'notification_email_enabled',
        value: 'true',
        defaultValue: 'true',
        type: SettingType.BOOLEAN,
        category: 'notifications',
        labelAr: 'تفعيل إشعارات البريد الإلكتروني',
        labelEn: 'Enable email notifications',
        editableByRoles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        key: 'notification_whatsapp_enabled',
        value: 'false',
        defaultValue: 'false',
        type: SettingType.BOOLEAN,
        category: 'notifications',
        labelAr: 'تفعيل إشعارات واتساب',
        labelEn: 'Enable WhatsApp notifications',
        editableByRoles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        key: 'notification_quiet_hours_start',
        value: '22',
        defaultValue: '22',
        type: SettingType.NUMBER,
        category: 'notifications',
        labelAr: 'بداية ساعات الهدوء',
        labelEn: 'Quiet hours start',
        minValue: 0,
        maxValue: 23,
        editableByRoles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        key: 'notification_quiet_hours_end',
        value: '7',
        defaultValue: '7',
        type: SettingType.NUMBER,
        category: 'notifications',
        labelAr: 'نهاية ساعات الهدوء',
        labelEn: 'Quiet hours end',
        minValue: 0,
        maxValue: 23,
        editableByRoles: ['SUPER_ADMIN', 'ADMIN'],
      },
      // Assignment
      {
        key: 'lead_auto_assign_strategy',
        value: 'round_robin',
        defaultValue: 'round_robin',
        type: SettingType.STRING,
        category: 'assignment',
        labelAr: 'استراتيجية التخصيص التلقائي',
        labelEn: 'Auto-assign strategy',
        descriptionAr: 'off | round_robin | load_based',
        descriptionEn: 'off | round_robin | load_based',
        editableByRoles: ['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER'],
      },
    ],
  });
  console.log('✅ Created 22 system settings');

  console.log('Seeding Saudi public holidays (2026-2027)...');
  const d = (isoDate: string) => new Date(`${isoDate}T00:00:00.000Z`);
  await prisma.publicHoliday.createMany({
    data: [
      {
        date: d('2026-02-22'),
        nameAr: 'يوم التأسيس',
        nameEn: 'Saudi Founding Day',
        isRecurring: true,
      },
      {
        date: d('2026-03-20'),
        nameAr: 'عيد الفطر - اليوم الأول',
        nameEn: 'Eid al-Fitr — Day 1',
      },
      {
        date: d('2026-03-21'),
        nameAr: 'عيد الفطر - اليوم الثاني',
        nameEn: 'Eid al-Fitr — Day 2',
      },
      {
        date: d('2026-03-22'),
        nameAr: 'عيد الفطر - اليوم الثالث',
        nameEn: 'Eid al-Fitr — Day 3',
      },
      {
        date: d('2026-05-27'),
        nameAr: 'عيد الأضحى - اليوم الأول',
        nameEn: 'Eid al-Adha — Day 1',
      },
      {
        date: d('2026-05-28'),
        nameAr: 'عيد الأضحى - اليوم الثاني',
        nameEn: 'Eid al-Adha — Day 2',
      },
      {
        date: d('2026-05-29'),
        nameAr: 'عيد الأضحى - اليوم الثالث',
        nameEn: 'Eid al-Adha — Day 3',
      },
      {
        date: d('2026-05-30'),
        nameAr: 'عيد الأضحى - اليوم الرابع',
        nameEn: 'Eid al-Adha — Day 4',
      },
      {
        date: d('2026-09-23'),
        nameAr: 'اليوم الوطني',
        nameEn: 'Saudi National Day',
        isRecurring: true,
      },
      {
        date: d('2027-02-22'),
        nameAr: 'يوم التأسيس',
        nameEn: 'Saudi Founding Day',
        isRecurring: true,
      },
      {
        date: d('2027-03-09'),
        nameAr: 'عيد الفطر - اليوم الأول',
        nameEn: 'Eid al-Fitr — Day 1',
      },
      {
        date: d('2027-03-10'),
        nameAr: 'عيد الفطر - اليوم الثاني',
        nameEn: 'Eid al-Fitr — Day 2',
      },
      {
        date: d('2027-03-11'),
        nameAr: 'عيد الفطر - اليوم الثالث',
        nameEn: 'Eid al-Fitr — Day 3',
      },
      {
        date: d('2027-05-16'),
        nameAr: 'عيد الأضحى - اليوم الأول',
        nameEn: 'Eid al-Adha — Day 1',
      },
      {
        date: d('2027-05-17'),
        nameAr: 'عيد الأضحى - اليوم الثاني',
        nameEn: 'Eid al-Adha — Day 2',
      },
      {
        date: d('2027-05-18'),
        nameAr: 'عيد الأضحى - اليوم الثالث',
        nameEn: 'Eid al-Adha — Day 3',
      },
      {
        date: d('2027-05-19'),
        nameAr: 'عيد الأضحى - اليوم الرابع',
        nameEn: 'Eid al-Adha — Day 4',
      },
      {
        date: d('2027-09-23'),
        nameAr: 'اليوم الوطني',
        nameEn: 'Saudi National Day',
        isRecurring: true,
      },
    ],
  });
  console.log('✅ Seeded 18 Saudi public holidays');

  console.log('Creating sample leads...');
  const salesRep = await prisma.user.findFirst({
    where: { role: UserRole.SALES_REPRESENTATIVE },
  });
  const structuralService = await prisma.service.findUnique({
    where: { code: 'SRV-02' },
  });
  const year = new Date().getFullYear();
  const hour = 60 * 60 * 1000;

  await prisma.lead.createMany({
    data: [
      {
        leadNumber: `LEAD-${year}-0001`,
        channel: LeadChannel.GOVERNMENT_TENDER,
        source: 'Etimad Platform',
        etimadNumber: 'ET-2024-12345',
        tenderDeadline: new Date(Date.now() + 30 * 24 * hour),
        contactName: 'مدير المشاريع - وزارة الإسكان',
        companyName: 'وزارة الإسكان',
        email: 'projects@housing.gov.sa',
        phone: '+966112345678',
        serviceId: structuralService?.id,
        serviceDetails: 'Structural design for 50-unit residential complex',
        projectLocation: 'Riyadh',
        budget: 500000,
        timeline: '6 months',
        status: LeadStatus.ASSIGNED,
        priority: LeadPriority.HIGH,
        assignedToId: salesRep?.id,
        assignedAt: new Date(),
        slaResponseDue: new Date(Date.now() + 24 * hour),
        slaStatus: SLAStatus.ON_TIME,
      },
      {
        leadNumber: `LEAD-${year}-0002`,
        channel: LeadChannel.REFERRAL,
        source: 'Client Referral',
        referredBy: 'Ahmed Al-Dosari',
        referrerPhone: '+966501234567',
        referrerCompany: 'Al-Dosari Contracting',
        contactName: 'Mohammed Al-Ghamdi',
        companyName: 'Al-Ghamdi Real Estate',
        email: 'mghamdi@alghamdi-re.com',
        phone: '+966507654321',
        serviceDetails: 'MEP design for commercial building',
        projectLocation: 'Jeddah',
        budget: 300000,
        status: LeadStatus.NEW,
        priority: LeadPriority.MEDIUM,
        slaResponseDue: new Date(Date.now() + 20 * hour),
        slaStatus: SLAStatus.ON_TIME,
      },
      {
        leadNumber: `LEAD-${year}-0003`,
        channel: LeadChannel.WEBSITE,
        source: 'Contact Form',
        contactName: 'Fatimah Al-Otaibi',
        companyName: 'Al-Otaibi Development',
        email: 'f.otaibi@aod.sa',
        phone: '+966556789012',
        serviceDetails: 'Architectural design for villa',
        projectLocation: 'Dammam',
        status: LeadStatus.NEW,
        priority: LeadPriority.LOW,
        slaResponseDue: new Date(Date.now() + 24 * hour),
        slaStatus: SLAStatus.ON_TIME,
      },
      {
        leadNumber: `LEAD-${year}-0004`,
        channel: LeadChannel.SOCIAL_MEDIA,
        source: 'LinkedIn',
        socialPlatform: 'LinkedIn',
        socialProfile: 'https://linkedin.com/in/khalid-alsalem',
        contactName: 'Khalid Al-Salem',
        email: 'k.salem@example.com',
        phone: '+966543210987',
        serviceDetails: 'Structural inspection for existing building',
        status: LeadStatus.CONTACTED,
        priority: LeadPriority.MEDIUM,
        assignedToId: salesRep?.id,
        assignedAt: new Date(Date.now() - 2 * hour),
        firstResponseAt: new Date(Date.now() - 1 * hour),
        slaStatus: SLAStatus.ON_TIME,
      },
      {
        leadNumber: `LEAD-${year}-0005`,
        channel: LeadChannel.WALK_IN,
        source: 'Office Visit',
        contactName: 'Sarah Al-Harbi',
        phone: '+966598765432',
        serviceDetails: 'General consultation',
        status: LeadStatus.QUALIFIED,
        priority: LeadPriority.MEDIUM,
        assignedToId: salesRep?.id,
        assignedAt: new Date(Date.now() - 3 * hour),
        firstResponseAt: new Date(Date.now() - 3 * hour),
        qualificationScore: 75,
        qualificationNotes: 'Serious buyer, has land and budget',
        slaStatus: SLAStatus.ON_TIME,
      },
    ],
  });
  console.log('✅ Created 5 sample leads');

  console.log('Creating sample clients...');
  const manager = await prisma.user.findFirst({
    where: { role: UserRole.SALES_MANAGER },
  });

  const vipClient = await prisma.client.create({
    data: {
      clientNumber: `CLIENT-${year}-0001`,
      contactName: 'Abdulrahman Al-Fahad',
      companyName: 'Al-Fahad Development',
      email: 'a.fahad@alfahad-dev.sa',
      phone: '+966501112233',
      addressLine1: 'King Fahd Road',
      city: 'Riyadh',
      region: 'Riyadh',
      country: 'Saudi Arabia',
      classification: ClientClassification.VIP,
      classificationManual: true,
      status: ClientStatus.ACTIVE,
      creditLimit: 2000000,
      paymentTerms: 'Net 30',
      accountManagerId: manager?.id,
      lifetimeValue: 1200000,
      satisfactionScore: 92,
      lastInteractionAt: new Date(Date.now() - 2 * 24 * hour),
    },
  });

  const returningClient = await prisma.client.create({
    data: {
      clientNumber: `CLIENT-${year}-0002`,
      contactName: 'Sarah Al-Harbi',
      companyName: 'Harbi Residential',
      email: 'sarah@harbi-res.sa',
      phone: '+966598765432',
      city: 'Jeddah',
      region: 'Makkah',
      classification: ClientClassification.RETURNING,
      status: ClientStatus.ACTIVE,
      accountManagerId: salesRep?.id,
      lifetimeValue: 450000,
      lastInteractionAt: new Date(Date.now() - 10 * 24 * hour),
    },
  });

  await prisma.client.create({
    data: {
      clientNumber: `CLIENT-${year}-0003`,
      contactName: 'Omar Al-Qahtani',
      companyName: 'Qahtani Industrial',
      email: 'omar@qahtani-ind.sa',
      phone: '+966556667788',
      city: 'Dammam',
      region: 'Eastern Province',
      classification: ClientClassification.DORMANT,
      status: ClientStatus.ACTIVE,
      accountManagerId: salesRep?.id,
      lifetimeValue: 180000,
      lastInteractionAt: new Date(Date.now() - 240 * 24 * hour),
    },
  });
  console.log('✅ Created 3 sample clients');

  console.log('Creating sample interactions + follow-ups + notes...');
  await prisma.interaction.createMany({
    data: [
      {
        clientId: vipClient.id,
        type: InteractionType.MEETING,
        direction: InteractionDirection.OUTBOUND,
        subject: 'Quarterly portfolio review',
        summary: 'Walked through active projects, planned 2 new bids',
        location: 'Client HQ, Riyadh',
        outcome: 'Green-lit RFQ for residential tower',
        nextAction: 'Send proposal by EOW',
        authorId: manager?.id,
        occurredAt: new Date(Date.now() - 2 * 24 * hour),
        durationMinutes: 90,
      },
      {
        clientId: vipClient.id,
        type: InteractionType.PHONE_CALL,
        direction: InteractionDirection.INBOUND,
        subject: 'Question about PO-2026-0045',
        summary: 'Clarified payment schedule; client asked for 45-day terms',
        authorId: manager?.id,
        occurredAt: new Date(Date.now() - 5 * 24 * hour),
        durationMinutes: 15,
      },
      {
        clientId: returningClient.id,
        type: InteractionType.EMAIL,
        direction: InteractionDirection.OUTBOUND,
        subject: 'Following up on villa drawings',
        summary: 'Sent revised drawings; awaiting approval',
        authorId: salesRep?.id,
        occurredAt: new Date(Date.now() - 10 * 24 * hour),
      },
    ],
  });

  await prisma.followUp.createMany({
    data: [
      {
        clientId: vipClient.id,
        title: 'Send portfolio proposal',
        description: 'Deliver the residential-tower RFQ response',
        type: FollowUpType.QUOTE,
        dueAt: new Date(Date.now() + 2 * 24 * hour),
        status: FollowUpStatus.PENDING,
        assignedToId: manager?.id,
      },
      {
        clientId: returningClient.id,
        title: 'Check in on villa approval',
        description: 'Confirm revised drawings were reviewed',
        type: FollowUpType.GENERAL,
        dueAt: new Date(Date.now() - 1 * 24 * hour),
        status: FollowUpStatus.OVERDUE,
        assignedToId: salesRep?.id,
      },
    ],
  });

  await prisma.clientNote.create({
    data: {
      clientId: vipClient.id,
      body: 'CEO prefers Wednesday morning calls. Avoid Thursdays.',
      tag: 'IMPORTANT',
      authorId: manager?.id,
    },
  });
  console.log('✅ Created 3 interactions, 2 follow-ups, 1 note');

  console.log('Creating sample pipeline entry + RFQ...');
  const pipelineEntry = await prisma.pipelineEntry.create({
    data: {
      stage: 'READY_FOR_RFQ',
      clientId: vipClient.id,
      ownerId: manager?.id ?? salesRep?.id,
      estimatedValue: 750000,
      probability: 60,
      nextStep: 'Prepare technical + financial response for residential tower',
      readyForRfqAt: new Date(),
    },
  });

  await prisma.rfq.create({
    data: {
      rfqNumber: `RFQ-${year}-0001`,
      opportunityId: pipelineEntry.id,
      clientId: vipClient.id,
      serviceType: 'Architectural Design + MEP',
      projectScope:
        'Full architectural and MEP design for a 12-floor residential tower in Riyadh, including detailed drawings, BOQ, and coordination with structural consultant.',
      priority: 'HIGH',
      requestedByChannel: 'SALES_MANAGER',
      originalSalesRepId: salesRep?.id,
      coordinatorId: salesRep?.id,
      coordinatorAssignedAt: new Date(),
      status: 'ASSIGNED',
    },
  });
  console.log('✅ Created 1 pipeline entry + 1 RFQ');

  console.log('✨ Database seeding completed successfully!');
  console.log(`\n📋 Login credentials:`);
  console.log(`   admin@abak.com    / ${DEFAULT_PASSWORD}`);
  console.log(`   manager@abak.com  / ${DEFAULT_PASSWORD}`);
  console.log(`   rep1@abak.com     / ${DEFAULT_PASSWORD}`);
  console.log(`   rep2@abak.com     / ${DEFAULT_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
