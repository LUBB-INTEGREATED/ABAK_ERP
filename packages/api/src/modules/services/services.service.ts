import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.service.findMany({
      where: { isActive: true },
      orderBy: [{ category: { order: 'asc' } }, { name: 'asc' }],
      include: { category: { select: { id: true, name: true } } },
    });
  }
}
