import { Controller, Get, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  getProfile(@CurrentUser() user: any) {
    return this.usersService.findById(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update profile' })
  updateProfile(@CurrentUser() user: any, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Patch('me/preferences')
  @ApiOperation({ summary: 'Update preferences' })
  updatePreferences(@CurrentUser() user: any, @Body() dto: UpdatePreferencesDto) {
    return this.usersService.updatePreferences(user.id, dto);
  }

  @Patch('me/onboarding')
  @ApiOperation({ summary: 'Mark onboarding complete' })
  completeOnboarding(@CurrentUser() user: any) {
    return this.usersService.completeOnboarding(user.id);
  }

  @Get('me/devices')
  @ApiOperation({ summary: 'Get user devices' })
  getDevices(@CurrentUser() user: any) {
    return this.usersService.getDevices(user.id);
  }

  @Delete('me/devices/:deviceId')
  @ApiOperation({ summary: 'Remove a device' })
  removeDevice(@CurrentUser() user: any, @Param('deviceId') deviceId: string) {
    return this.usersService.removeDevice(user.id, deviceId);
  }

  @Get('me/export')
  @ApiOperation({ summary: 'Export all user data' })
  exportData(@CurrentUser() user: any) {
    return this.usersService.exportData(user.id);
  }

  @Delete('me')
  @ApiOperation({ summary: 'Delete account' })
  deleteAccount(@CurrentUser() user: any) {
    return this.usersService.deleteAccount(user.id);
  }
}
