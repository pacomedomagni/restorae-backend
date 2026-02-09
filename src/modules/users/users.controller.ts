import { Controller, Get, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { UserPayload } from '../../common/types/user-payload.interface';
import {
  UserProfileResponseDto,
  PreferencesResponseDto,
  DeviceResponseDto,
  DataExportResponseDto,
  MessageResponseDto,
} from '../../common/dto/responses.dto';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile', type: UserProfileResponseDto })
  getProfile(@CurrentUser() user: UserPayload) {
    return this.usersService.findById(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update profile' })
  @ApiResponse({ status: 200, description: 'Profile updated', type: UserProfileResponseDto })
  updateProfile(@CurrentUser() user: UserPayload, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Patch('me/preferences')
  @ApiOperation({ summary: 'Update preferences' })
  @ApiResponse({ status: 200, description: 'Preferences updated', type: PreferencesResponseDto })
  updatePreferences(@CurrentUser() user: UserPayload, @Body() dto: UpdatePreferencesDto) {
    return this.usersService.updatePreferences(user.id, dto);
  }

  @Patch('me/onboarding')
  @ApiOperation({ summary: 'Mark onboarding complete' })
  @ApiResponse({ status: 200, description: 'Onboarding completed', type: UserProfileResponseDto })
  completeOnboarding(@CurrentUser() user: UserPayload) {
    return this.usersService.completeOnboarding(user.id);
  }

  @Get('me/devices')
  @ApiOperation({ summary: 'Get user devices' })
  @ApiResponse({ status: 200, description: 'User devices', type: [DeviceResponseDto] })
  getDevices(@CurrentUser() user: UserPayload) {
    return this.usersService.getDevices(user.id);
  }

  @Delete('me/devices/:deviceId')
  @ApiOperation({ summary: 'Remove a device' })
  @ApiResponse({ status: 200, description: 'Device removed', type: MessageResponseDto })
  removeDevice(@CurrentUser() user: UserPayload, @Param('deviceId') deviceId: string) {
    return this.usersService.removeDevice(user.id, deviceId);
  }

  @Get('me/export')
  @ApiOperation({ summary: 'Export all user data' })
  @ApiResponse({ status: 200, description: 'User data export', type: DataExportResponseDto })
  exportData(@CurrentUser() user: UserPayload) {
    return this.usersService.exportData(user.id);
  }

  @Delete('me')
  @ApiOperation({ summary: 'Delete account' })
  @ApiResponse({ status: 200, description: 'Account deleted', type: MessageResponseDto })
  deleteAccount(@CurrentUser() user: UserPayload) {
    return this.usersService.deleteAccount(user.id);
  }
}
