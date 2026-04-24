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

  await prisma.savedReport.deleteMany();
  await prisma.escalationInstance.deleteMany();
  await prisma.escalationRule.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.govDocument.deleteMany();
  await prisma.govComment.deleteMany();
  await prisma.govVisit.deleteMany();
  await prisma.govTransaction.deleteMany();
  await prisma.commission.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.commercialConfirmation.deleteMany();
  await prisma.closureChecklist.deleteMany();
  await prisma.taskDependency.deleteMany();
  await prisma.task.deleteMany();
  await prisma.phase.deleteMany();
  await prisma.project.deleteMany();
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
      // Approval thresholds (BR-07 — L1 + L2 are always required; these flag
      // when to ADD additional approvers, not whether approvals happen at all.)
      {
        key: 'approval_quote_level2_threshold',
        value: '500000',
        defaultValue: '500000',
        type: SettingType.NUMBER,
        category: 'approval',
        labelAr:
          'حد تصعيد المستوى 2 (ريال) — عرض يتجاوز هذه القيمة يتطلب المدير التنفيذي',
        labelEn:
          'Level 2 escalation threshold (SAR) — quotes above this figure require Executive Director',
        minValue: 0,
        editableByRoles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        key: 'approval_quote_level3_threshold',
        value: '1000000',
        defaultValue: '1000000',
        type: SettingType.NUMBER,
        category: 'approval',
        labelAr: 'حد تصعيد المستوى 3 (ريال) — إضافة الرئيس التنفيذي كمعتمد',
        labelEn:
          'Level 3 escalation threshold (SAR) — adds CEO as additional approver',
        minValue: 0,
        editableByRoles: ['SUPER_ADMIN'],
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
  console.log('✅ Created 23 system settings');

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

  console.log('Creating sample quote + PO + project...');
  const sampleQuote = await prisma.quote.create({
    data: {
      quoteNumber: `QUO-${year}-0001`,
      clientId: vipClient.id,
      title: 'Residential Tower — Full Design Package',
      description: 'Architectural + MEP + structural design coordination.',
      subtotal: 750000,
      discountType: 'FIXED',
      discountValue: 0,
      discountAmount: 0,
      taxRate: 15,
      taxAmount: 112500,
      totalAmount: 862500,
      status: 'WON',
      wonAt: new Date(),
      sentAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      preparedById: manager?.id ?? salesRep?.id,
      paymentMilestones: {
        create: [
          {
            description: 'Kickoff advance',
            percentage: 30,
            amount: 258_750,
            daysFromStart: 0,
            position: 0,
          },
          {
            description: 'Midway',
            percentage: 40,
            amount: 345_000,
            daysFromStart: 60,
            position: 1,
          },
          {
            description: 'Final delivery',
            percentage: 30,
            amount: 258_750,
            daysFromStart: 120,
            position: 2,
          },
        ],
      },
    },
  });
  const samplePo = await prisma.purchaseOrder.create({
    data: {
      poNumber: `PO-${year}-0001`,
      quoteId: sampleQuote.id,
      clientId: vipClient.id,
      poDate: new Date(),
      startDate: new Date(),
      contractValue: sampleQuote.totalAmount,
      status: 'ACTIVE',
    },
  });

  const projectStart = new Date();
  const sampleProject = await prisma.project.create({
    data: {
      projectNumber: `PRJ-${year}-0001`,
      poId: samplePo.id,
      clientId: vipClient.id,
      title: 'Residential Tower — Riyadh',
      description:
        'Full consulting engagement for a 12-floor residential tower.',
      pmId: manager?.id ?? salesRep!.id,
      status: 'ACTIVE',
      contractValue: samplePo.contractValue,
      startDate: projectStart,
    },
  });
  // Seed 7 default phases via the template definition above.
  const projectPhases: Array<{
    name: string;
    phaseCode:
      | 'INITIATION'
      | 'KICKOFF'
      | 'EXECUTION'
      | 'REVIEW'
      | 'SUBMISSION'
      | 'REVISIONS'
      | 'CLOSURE';
    durationDays: number;
    position: number;
  }> = [
    {
      name: 'Initiation',
      phaseCode: 'INITIATION',
      position: 0,
      durationDays: 7,
    },
    { name: 'Kickoff', phaseCode: 'KICKOFF', position: 1, durationDays: 5 },
    {
      name: 'Execution',
      phaseCode: 'EXECUTION',
      position: 2,
      durationDays: 45,
    },
    { name: 'Review', phaseCode: 'REVIEW', position: 3, durationDays: 10 },
    {
      name: 'Submission',
      phaseCode: 'SUBMISSION',
      position: 4,
      durationDays: 7,
    },
    {
      name: 'Revisions',
      phaseCode: 'REVISIONS',
      position: 5,
      durationDays: 14,
    },
    { name: 'Closure', phaseCode: 'CLOSURE', position: 6, durationDays: 7 },
  ];
  let cursor = new Date(projectStart);
  for (const phase of projectPhases) {
    const plannedEnd = new Date(cursor);
    plannedEnd.setDate(plannedEnd.getDate() + phase.durationDays);
    await prisma.phase.create({
      data: {
        projectId: sampleProject.id,
        name: phase.name,
        phaseCode: phase.phaseCode,
        position: phase.position,
        ownerId: manager?.id ?? salesRep!.id,
        plannedStart: new Date(cursor),
        plannedEnd,
      },
    });
    cursor = plannedEnd;
  }
  console.log('✅ Created 1 quote + 1 PO + 1 project (with 7 phases)');

  console.log('Creating sample finance records...');
  // Validated commercial confirmation (for the already-linked PO).
  await prisma.commercialConfirmation.create({
    data: {
      quoteId: sampleQuote.id,
      type: 'PO',
      contractValue: sampleQuote.totalAmount,
      validationStatus: 'VALIDATED',
      validatedAt: new Date(),
      validatedById: manager?.id,
      notes: 'Client sent signed PO via email.',
    },
  });

  // A second WON quote + PO for the same VIP client whose commercial
  // confirmation is PENDING, so the Finance dashboard has a queue.
  const secondQuote = await prisma.quote.create({
    data: {
      quoteNumber: `QUO-${year}-0002`,
      clientId: vipClient.id,
      title: 'Interior Design — Executive Floor',
      subtotal: 180000,
      discountType: 'FIXED',
      discountValue: 0,
      discountAmount: 0,
      taxRate: 15,
      taxAmount: 27000,
      totalAmount: 207000,
      status: 'WON',
      wonAt: new Date(),
      sentAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      preparedById: manager?.id ?? salesRep?.id,
    },
  });
  await prisma.commercialConfirmation.create({
    data: {
      quoteId: secondQuote.id,
      type: 'CONTRACT',
      contractValue: secondQuote.totalAmount,
      validationStatus: 'PENDING',
      notes: 'Awaiting Finance sign-off on the signed contract.',
    },
  });

  // Invoice + pending payment on the original PO
  const firstInvoice = await prisma.invoice.create({
    data: {
      invoiceNumber: `INV-${year}-0001`,
      poId: samplePo.id,
      clientId: vipClient.id,
      projectId: sampleProject.id,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      subtotal: 225000,
      taxAmount: 33750,
      totalAmount: 258750,
      status: 'ISSUED',
    },
  });
  await prisma.payment.create({
    data: {
      paymentNumber: `PAY-${year}-0001`,
      poId: samplePo.id,
      invoiceId: firstInvoice.id,
      clientId: vipClient.id,
      amount: 258750,
      method: 'BANK_TRANSFER',
      receivedAt: new Date(),
      referenceNumber: 'SAR-TRX-99281',
      validationStatus: 'PENDING',
    },
  });
  console.log(
    '✅ Created 1 validated confirmation + 1 pending confirmation + 1 invoice + 1 pending payment',
  );

  console.log('Creating sample government transaction...');
  const sampleGovTx = await prisma.govTransaction.create({
    data: {
      transactionNumber: `GOV-${year}-0001`,
      projectId: sampleProject.id,
      authorityName: 'أمانة منطقة الرياض',
      authorityCategory: 'MUNICIPALITY',
      transactionType: 'Building Permit',
      referenceNumber: 'BP-2026-8812',
      assignedProId: salesRep?.id, // reusing seed user; real PRO role would be separate
      submittedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      expectedResponseAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      fees: 12000,
      feesPaid: true,
      feesPaidAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      status: 'UNDER_REVIEW',
      weeklyStatusLastAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.govVisit.create({
    data: {
      transactionId: sampleGovTx.id,
      visitedById: salesRep!.id,
      visitedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      purpose: 'Submit signed architectural drawings',
      outcome: 'Drawings accepted; awaiting structural review.',
      nextAction: 'Follow up in 7 days.',
      latitude: 24.7136,
      longitude: 46.6753,
    },
  });
  await prisma.govComment.create({
    data: {
      transactionId: sampleGovTx.id,
      commentText:
        'Structural calculations need revised seismic load assumptions.',
      issuedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  });
  console.log('✅ Created 1 gov transaction + 1 visit + 1 pending comment');

  console.log('Creating sample notifications...');
  if (manager?.id) {
    await prisma.notification.createMany({
      data: [
        {
          recipientId: manager.id,
          eventCode: 'commercial_confirmation.pending',
          subject: 'تأكيد تجاري بانتظار الاعتماد',
          body: 'العرض QUO-2026-0002 بقيمة 207,000 ر.س بانتظار اعتمادك.',
          priority: 'HIGH',
          deepLink: '/finance',
        },
        {
          recipientId: manager.id,
          eventCode: 'payment.validation_pending',
          subject: 'دفعة بانتظار التحقق',
          body: 'تم استلام دفعة 258,750 ر.س على PO-2026-0001. يلزم التحقق.',
          priority: 'HIGH',
          deepLink: '/finance',
        },
        {
          recipientId: manager.id,
          eventCode: 'gov.comment_received',
          subject: 'تعليق جديد من الأمانة',
          body: 'وردت ملاحظة على معاملة GOV-2026-0001 بخصوص الأحمال الزلزالية.',
          priority: 'NORMAL',
          deepLink: '/gov-transactions',
        },
      ],
    });
  }
  console.log('✅ Created 3 sample notifications');

  console.log('Seeding escalation rules (PART 8)...');
  await prisma.escalationRule.createMany({
    data: [
      {
        code: 'QUOTE_APPROVAL_BREACH',
        name: 'Quote awaiting approval past SLA',
        descriptionAr: 'تجاوز عرض السعر SLA الموافقة.',
        descriptionEn: 'Quote has been pending approval past the SLA window.',
        level1DelayHours: 24,
        level2DelayHours: 24,
        level3DelayHours: 24,
        level1RecipientSelector: 'role:SALES_MANAGER',
        level2RecipientSelector: 'role:ADMIN',
        level3RecipientSelector: 'role:SUPER_ADMIN',
        channels: ['IN_APP', 'EMAIL'],
      },
      {
        code: 'PAYMENT_VALIDATION_OVERDUE',
        name: 'Payment awaiting validation past 24h',
        descriptionAr: 'دفعة لم يتم التحقق منها خلال 24 ساعة.',
        descriptionEn:
          'Payment has been awaiting Finance validation for > 24h.',
        level1DelayHours: 24,
        level2DelayHours: 24,
        level3DelayHours: 24,
        level1RecipientSelector: 'role:FINANCE_MANAGER',
        level2RecipientSelector: 'role:ADMIN',
        level3RecipientSelector: 'role:SUPER_ADMIN',
        channels: ['IN_APP', 'EMAIL'],
      },
      {
        code: 'GOV_WEEKLY_STATUS_MISSING',
        name: 'Weekly gov status missing',
        descriptionAr: 'لم يتم إدخال تحديث أسبوعي على معاملة حكومية.',
        descriptionEn: 'No weekly status update on a gov transaction.',
        level1DelayHours: 24,
        level2DelayHours: 24,
        level3DelayHours: 24,
        level1RecipientSelector: 'role:PRO',
        level2RecipientSelector: 'role:SALES_MANAGER',
        level3RecipientSelector: 'role:SUPER_ADMIN',
        channels: ['IN_APP'],
      },
    ],
  });
  console.log('✅ Seeded 3 escalation rules');

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
