import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateServiceCategoryDto,
  CreateServiceDto,
  UpdateServiceCategoryDto,
  UpdateServiceDto,
} from './dto';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  // Services -----------------------------------------------------

  findAll(includeInactive = false) {
    return this.prisma.service.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ category: { order: 'asc' } }, { name: 'asc' }],
      include: {
        category: { select: { id: true, name: true, nameAr: true } },
      },
    });
  }

  async findOne(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!service) throw new NotFoundException(`Service ${id} not found`);
    return service;
  }

  async create(dto: CreateServiceDto) {
    await this.ensureCategoryExists(dto.categoryId);
    try {
      return await this.prisma.service.create({
        data: {
          categoryId: dto.categoryId,
          name: dto.name,
          code: dto.code,
          description: dto.description,
          basePrice: dto.basePrice,
          unit: dto.unit,
          isActive: dto.isActive ?? true,
        },
        include: { category: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Service code must be unique');
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateServiceDto) {
    await this.findOne(id);
    if (dto.categoryId) await this.ensureCategoryExists(dto.categoryId);
    try {
      return await this.prisma.service.update({
        where: { id },
        data: dto,
        include: { category: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Service code must be unique');
      }
      throw error;
    }
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.service.update({
      where: { id },
      data: { isActive: false },
      include: { category: true },
    });
  }

  // Categories ---------------------------------------------------

  async findCategories(includeInactive = false) {
    const cats = await this.prisma.serviceCategory.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { order: 'asc' },
      include: {
        services: { where: { isActive: true }, select: { id: true } },
        // DM-15 fold: the owning real Department(s) for this category, so the
        // Accept sheet can resolve ServiceCategory → Department → members
        // (GET /departments/:id/members) without a second round-trip. RV3b-4:
        // deterministic order (DepartmentService is a bare join — no order/
        // createdAt column without a migration; departmentId asc is stable) so
        // the primary fold doesn't flip between requests. The web picker falls
        // back over `departmentIds` when the primary department 403s the caller.
        departmentLinks: {
          select: { departmentId: true },
          orderBy: { departmentId: 'asc' },
        },
      },
    });
    return cats.map(({ departmentLinks, ...c }) => ({
      ...c,
      // `departmentId` is the primary (first) owning department, null when the
      // category isn't linked yet; `departmentIds` lists all links.
      departmentId: departmentLinks[0]?.departmentId ?? null,
      departmentIds: departmentLinks.map((l) => l.departmentId),
    }));
  }

  createCategory(dto: CreateServiceCategoryDto) {
    return this.prisma.serviceCategory.create({
      data: {
        name: dto.name,
        description: dto.description,
        icon: dto.icon,
        order: dto.order ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateCategory(id: string, dto: UpdateServiceCategoryDto) {
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id },
    });
    if (!category) throw new NotFoundException(`Category ${id} not found`);
    return this.prisma.serviceCategory.update({
      where: { id },
      data: dto,
    });
  }

  private async ensureCategoryExists(id: string) {
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });
    if (!category) {
      throw new NotFoundException(`Category ${id} not found`);
    }
  }
}
