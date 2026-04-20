import { PrismaClient, UserRole, UserStatus, SettingType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'Password123!';

async function main() {
  console.log('🌱 Seeding database...');

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
      { categoryId: structural.id, name: 'Structural Design & Calculations', description: 'Complete structural design and calculations for buildings', code: 'STRUCT-001', basePrice: 50000, unit: 'per project' },
      { categoryId: structural.id, name: 'Foundation Design', description: 'Foundation design and soil analysis', code: 'STRUCT-002', basePrice: 25000, unit: 'per project' },
      { categoryId: structural.id, name: 'Structural Inspection', description: 'On-site structural inspection and reporting', code: 'STRUCT-003', basePrice: 5000, unit: 'per visit' },
      { categoryId: architectural.id, name: 'Architectural Design', description: 'Complete architectural design and planning', code: 'ARCH-001', basePrice: 60000, unit: 'per project' },
      { categoryId: architectural.id, name: '3D Visualization', description: '3D rendering and visualization services', code: 'ARCH-002', basePrice: 15000, unit: 'per project' },
      { categoryId: mep.id, name: 'MEP Design', description: 'Mechanical, Electrical, and Plumbing design', code: 'MEP-001', basePrice: 45000, unit: 'per project' },
      { categoryId: mep.id, name: 'Energy Efficiency Analysis', description: 'Energy efficiency and sustainability analysis', code: 'MEP-002', basePrice: 20000, unit: 'per project' },
    ],
  });
  console.log(`✅ Created ${services.count} services`);

  console.log('Creating system settings...');
  await prisma.systemSetting.createMany({
    data: [
      { key: 'sla_lead_response_hours', value: '24', type: SettingType.NUMBER, category: 'sla', description: 'Hours before lead requires response' },
      { key: 'sla_quote_delivery_days', value: '7', type: SettingType.NUMBER, category: 'sla', description: 'Days to deliver quote after RFQ' },
      { key: 'approval_threshold_tier1', value: '50000', type: SettingType.NUMBER, category: 'approval', description: 'Quote value requiring manager approval (SAR)' },
      { key: 'approval_threshold_tier2', value: '200000', type: SettingType.NUMBER, category: 'approval', description: 'Quote value requiring senior management approval (SAR)' },
      { key: 'notification_email_enabled', value: 'true', type: SettingType.BOOLEAN, category: 'notification', description: 'Enable email notifications' },
      { key: 'notification_whatsapp_enabled', value: 'false', type: SettingType.BOOLEAN, category: 'notification', description: 'Enable WhatsApp notifications' },
    ],
  });
  console.log('✅ Created 6 system settings');

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
