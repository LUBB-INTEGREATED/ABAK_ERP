import { Injectable, NotFoundException } from '@nestjs/common';
import {
  addWorkingDays,
  buildHolidaySet,
  isWorkingDay,
  workingDaysBetween,
} from 'shared-utils';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertHolidayDto } from './dto/upsert-holiday.dto';

function normalizeDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

@Injectable()
export class HolidaysService {
  private cache: { set: Set<string>; loadedAt: number } | null = null;
  private readonly CACHE_TTL_MS = 60 * 1000;

  constructor(private readonly prisma: PrismaService) {}

  list(from?: string, to?: string) {
    return this.prisma.publicHoliday.findMany({
      where: {
        date: {
          gte: from ? normalizeDate(from) : undefined,
          lte: to ? normalizeDate(to) : undefined,
        },
      },
      orderBy: { date: 'asc' },
    });
  }

  create(dto: UpsertHolidayDto) {
    return this.prisma.publicHoliday.create({
      data: {
        date: normalizeDate(dto.date),
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        isRecurring: dto.isRecurring ?? false,
        notes: dto.notes,
      },
    });
  }

  async update(id: string, dto: UpsertHolidayDto) {
    const existing = await this.prisma.publicHoliday.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException();
    this.cache = null;
    return this.prisma.publicHoliday.update({
      where: { id },
      data: {
        date: normalizeDate(dto.date),
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        isRecurring: dto.isRecurring ?? false,
        notes: dto.notes,
      },
    });
  }

  async remove(id: string) {
    this.cache = null;
    return this.prisma.publicHoliday.delete({ where: { id } });
  }

  async holidaySet(): Promise<Set<string>> {
    const now = Date.now();
    if (this.cache && now - this.cache.loadedAt < this.CACHE_TTL_MS) {
      return this.cache.set;
    }
    const rows = await this.prisma.publicHoliday.findMany({
      select: { date: true },
    });
    const set = buildHolidaySet(rows);
    this.cache = { set, loadedAt: now };
    return set;
  }

  async isWorkingDay(date: Date): Promise<boolean> {
    const holidays = await this.holidaySet();
    return isWorkingDay(date, { weekStart: 'sunday', holidays });
  }

  async addWorkingDays(from: Date, days: number): Promise<Date> {
    const holidays = await this.holidaySet();
    return addWorkingDays(from, days, { weekStart: 'sunday', holidays });
  }

  async workingDaysBetween(from: Date, to: Date): Promise<number> {
    const holidays = await this.holidaySet();
    return workingDaysBetween(from, to, { weekStart: 'sunday', holidays });
  }
}
