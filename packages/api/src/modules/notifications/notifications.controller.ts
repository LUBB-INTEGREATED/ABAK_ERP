import { Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Inbox — paginated, newest first' })
  list(
    @CurrentUser('id') userId: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.list(userId, {
      unreadOnly: unreadOnly === 'true',
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'How many unread notifications I have' })
  unreadCount(@CurrentUser('id') userId: string) {
    return this.service.unreadCount(userId);
  }

  @Patch(':id/mark-read')
  @ApiOperation({ summary: 'Mark one notification as read' })
  markRead(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.markRead(userId, id);
  }

  @Post('mark-all-read')
  @ApiOperation({ summary: 'Mark all my notifications as read' })
  markAllRead(@CurrentUser('id') userId: string) {
    return this.service.markAllRead(userId);
  }
}
