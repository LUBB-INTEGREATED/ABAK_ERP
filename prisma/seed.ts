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
  const structural = await prisma.serviceCategory.create({
    data: {
      name: 'Structural Engineering',
      description: 'Structural design and analysis services',
      icon: 'building',
      order: 1,
    },
  });

  const architectural = await prisma.serviceCategory.create({
    data: {
      name: 'Architectural Design',
      description: 'Architectural design and planning services',
      icon: 'blueprint',
      order: 2,
    },
  });

  const mep = await prisma.serviceCategory.create({
    data: {
      name: 'MEP Engineering',
      description: 'Mechanical, Electrical, and Plumbing services',
      icon: 'settings',
      order: 3,
    },
  });
  console.log('✅ Created 3 service categories');

  console.log('Creating services...');
  const services = await prisma.service.createMany({
    data: [
      {
        categoryId: structural.id,
        name: 'Structural Design & Calculations',
        description:
          'Complete structural design and calculations for buildings',
        code: 'STRUCT-001',
        basePrice: 50000,
        unit: 'per project',
      },
      {
        categoryId: structural.id,
        name: 'Foundation Design',
        description: 'Foundation design and soil analysis',
        code: 'STRUCT-002',
        basePrice: 25000,
        unit: 'per project',
      },
      {
        categoryId: structural.id,
        name: 'Structural Inspection',
        description: 'On-site structural inspection and reporting',
        code: 'STRUCT-003',
        basePrice: 5000,
        unit: 'per visit',
      },
      {
        categoryId: architectural.id,
        name: 'Architectural Design',
        description: 'Complete architectural design and planning',
        code: 'ARCH-001',
        basePrice: 60000,
        unit: 'per project',
      },
      {
        categoryId: architectural.id,
        name: '3D Visualization',
        description: '3D rendering and visualization services',
        code: 'ARCH-002',
        basePrice: 15000,
        unit: 'per project',
      },
      {
        categoryId: mep.id,
        name: 'MEP Design',
        description: 'Mechanical, Electrical, and Plumbing design',
        code: 'MEP-001',
        basePrice: 45000,
        unit: 'per project',
      },
      {
        categoryId: mep.id,
        name: 'Energy Efficiency Analysis',
        description: 'Energy efficiency and sustainability analysis',
        code: 'MEP-002',
        basePrice: 20000,
        unit: 'per project',
      },
    ],
  });
  console.log(`✅ Created ${services.count} services`);

  console.log('Creating system settings...');
  await prisma.systemSetting.createMany({
    data: [
      {
        key: 'sla_lead_response_hours',
        value: '24',
        type: SettingType.NUMBER,
        category: 'sla',
        description: 'Hours before lead requires response',
      },
      {
        key: 'sla_quote_delivery_days',
        value: '7',
        type: SettingType.NUMBER,
        category: 'sla',
        description: 'Days to deliver quote after RFQ',
      },
      {
        key: 'approval_threshold_tier1',
        value: '50000',
        type: SettingType.NUMBER,
        category: 'approval',
        description: 'Quote value requiring manager approval (SAR)',
      },
      {
        key: 'approval_threshold_tier2',
        value: '200000',
        type: SettingType.NUMBER,
        category: 'approval',
        description: 'Quote value requiring senior management approval (SAR)',
      },
      {
        key: 'notification_email_enabled',
        value: 'true',
        type: SettingType.BOOLEAN,
        category: 'notification',
        description: 'Enable email notifications',
      },
      {
        key: 'notification_whatsapp_enabled',
        value: 'false',
        type: SettingType.BOOLEAN,
        category: 'notification',
        description: 'Enable WhatsApp notifications',
      },
      {
        key: 'lead_auto_assign_strategy',
        value: 'round_robin',
        type: SettingType.STRING,
        category: 'assignment',
        description: 'Lead auto-assign: off | round_robin | load_based',
      },
    ],
  });
  console.log('✅ Created 7 system settings');

  console.log('Creating sample leads...');
  const salesRep = await prisma.user.findFirst({
    where: { role: UserRole.SALES_REPRESENTATIVE },
  });
  const structuralService = await prisma.service.findUnique({
    where: { code: 'STRUCT-001' },
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
