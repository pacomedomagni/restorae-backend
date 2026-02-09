import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserPayload } from '../../common/types/user-payload.interface';
import { RegisterPushTokenDto, CreateReminderDto, UpdateReminderDto } from './dto/notification.dto';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register push token' })
  @ApiResponse({ status: 201, description: 'Token registered' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  registerPushToken(
    @CurrentUser() user: UserPayload,
    @Body() body: RegisterPushTokenDto,
  ) {
    return this.notificationsService.registerPushToken(user.id, body.deviceId, body.pushToken);
  }

  @Get('reminders')
  @ApiOperation({ summary: 'Get reminders' })
  @ApiResponse({ status: 200, description: 'Reminders returned' })
  getReminders(@CurrentUser() user: UserPayload) {
    return this.notificationsService.getReminders(user.id);
  }

  @Post('reminders')
  @ApiOperation({ summary: 'Create reminder' })
  @ApiResponse({ status: 201, description: 'Reminder created' })
  createReminder(
    @CurrentUser() user: UserPayload,
    @Body() body: CreateReminderDto,
  ) {
    return this.notificationsService.createReminder(user.id, body);
  }

  @Patch('reminders/:id')
  @ApiOperation({ summary: 'Update reminder' })
  @ApiResponse({ status: 200, description: 'Reminder updated' })
  @ApiResponse({ status: 404, description: 'Not found' })
  updateReminder(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Body() body: UpdateReminderDto,
  ) {
    return this.notificationsService.updateReminder(user.id, id, body);
  }

  @Delete('reminders/:id')
  @ApiOperation({ summary: 'Delete reminder' })
  @ApiResponse({ status: 200, description: 'Reminder deleted' })
  @ApiResponse({ status: 404, description: 'Not found' })
  deleteReminder(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.notificationsService.deleteReminder(user.id, id);
  }

  @Post('reminders/:id/toggle')
  @ApiOperation({ summary: 'Toggle reminder' })
  @ApiResponse({ status: 201, description: 'Reminder toggled' })
  @ApiResponse({ status: 404, description: 'Not found' })
  toggleReminder(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.notificationsService.toggleReminder(user.id, id);
  }
}
