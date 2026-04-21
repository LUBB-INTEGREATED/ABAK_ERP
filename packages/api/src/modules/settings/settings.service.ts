import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SettingType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  list(category?: string) {
    return this.prisma.systemSetting.findMany({
      where: category ? { category } : undefined,
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });
  }

  async findOne(key: string) {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key },
    });
    if (!setting) throw new NotFoundException();
    return setting;
  }

  async history(key: string) {
    const setting = await this.findOne(key);
    return this.prisma.settingHistory.findMany({
      where: { settingId: setting.id },
      orderBy: { changedAt: 'desc' },
      take: 50,
    });
  }

  async update(
    key: string,
    value: string,
    actor: { id: string; role: string },
  ) {
    const setting = await this.findOne(key);
    this.assertEditableBy(setting, actor.role);
    this.assertValueValid(setting, value);

    const [updated] = await this.prisma.$transaction([
      this.prisma.systemSetting.update({
        where: { key },
        data: { value, updatedById: actor.id },
      }),
      this.prisma.settingHistory.create({
        data: {
          settingId: setting.id,
          oldValue: setting.value,
          newValue: value,
          changedById: actor.id,
        },
      }),
    ]);
    return updated;
  }

  async reset(key: string, actor: { id: string; role: string }) {
    const setting = await this.findOne(key);
    if (!setting.defaultValue) {
      throw new BadRequestException('No default value recorded');
    }
    return this.update(key, setting.defaultValue, actor);
  }

  private assertEditableBy(
    setting: { editableByRoles: string[] },
    role: string,
  ) {
    if (setting.editableByRoles.length === 0) return;
    if (!setting.editableByRoles.includes(role)) {
      throw new ForbiddenException('Not allowed to edit this setting');
    }
  }

  private assertValueValid(
    setting: {
      type: SettingType;
      minValue: number | null;
      maxValue: number | null;
    },
    value: string,
  ) {
    switch (setting.type) {
      case SettingType.NUMBER: {
        const n = Number(value);
        if (Number.isNaN(n))
          throw new BadRequestException('Value must be a number');
        if (setting.minValue != null && n < setting.minValue) {
          throw new BadRequestException(`Value below min ${setting.minValue}`);
        }
        if (setting.maxValue != null && n > setting.maxValue) {
          throw new BadRequestException(`Value above max ${setting.maxValue}`);
        }
        return;
      }
      case SettingType.BOOLEAN: {
        if (value !== 'true' && value !== 'false') {
          throw new BadRequestException('Value must be "true" or "false"');
        }
        return;
      }
      case SettingType.JSON: {
        try {
          JSON.parse(value);
        } catch {
          throw new BadRequestException('Value must be valid JSON');
        }
        return;
      }
      default:
        return;
    }
  }
}
