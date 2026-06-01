import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { SettingsService } from './settings.service';

@ApiTags('admin-settings')
@Controller('admin/settings')
@RequirePermission('settings:view')
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'List all settings (optionally by category)' })
  list(@Query('category') category?: string) {
    return this.service.list(category);
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get one setting by key' })
  findOne(@Param('key') key: string) {
    return this.service.findOne(key);
  }

  @Get(':key/history')
  @ApiOperation({ summary: 'Get audit history for a setting' })
  history(@Param('key') key: string) {
    return this.service.history(key);
  }

  @Patch(':key')
  @RequirePermission('settings:manage')
  @ApiOperation({ summary: 'Update a setting value' })
  update(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.service.update(key, dto.value, user);
  }

  @Post(':key/reset')
  @RequirePermission('settings:manage')
  @ApiOperation({ summary: 'Reset setting to default value' })
  reset(
    @Param('key') key: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.service.reset(key, user);
  }
}
