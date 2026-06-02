import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.user.count();
  console.log('USER_COUNT:', count);
  if (count > 0) {
    const users = await prisma.user.findMany({
      take: 5,
      select: { email: true, role: true },
    });
    console.log('SAMPLE_USERS:', users);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
