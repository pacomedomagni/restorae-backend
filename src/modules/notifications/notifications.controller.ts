import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register push token' })
  registerPushToken(
    @CurrentUser() user: any,
    @Body() body: { deviceId: string; pushToken: string },
  ) {
    return this.notificationsService.registerPushToken(user.id, body.deviceId, body.pushToken);
  }

  @Get('reminders')
  @ApiOperation({ summary: 'Get reminders' })
  getReminders(@CurrentUser() user: any) {
    return this.notificationsService.getReminders(user.id);
  }

  @Post('reminders')
  @ApiOperation({ summary: 'Create reminder' })
  createReminder(
    @CurrentUser() user: any,
    @Body() body: { type: string; label: string; time: string; ritualId?: string },
  ) {
    return this.notificationsService.createReminder(user.id, body);
  }

  @Patch('reminders/:id')
  @ApiOperation({ summary: 'Update reminder' })
  updateReminder(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { label?: string; time?: string; enabled?: boolean },
  ) {
    return this.notificationsService.updateReminder(user.id, id, body);
  }

  @Delete('reminders/:id')
  @ApiOperation({ summary: 'Delete reminder' })
  deleteReminder(@CurrentUser() user: any, @Param('id') id: string) {
    return this.notificationsService.deleteReminder(user.id, id);
  }

  @Post('reminders/:id/toggle')
  @ApiOperation({ summary: 'Toggle reminder' })
  toggleReminder(@CurrentUser() user: any, @Param('id') id: string) {
    return this.notificationsService.toggleReminder(user.id, id);
  }
}
