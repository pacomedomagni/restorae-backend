import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { PrismaService } from '../../../prisma/prisma.service';

@ApiTags('admin/users')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminUsersController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List users' })
  @ApiResponse({ status: 200, description: 'Users retrieved' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async list(
    @Query('search') search?: string,
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
  ) {
    return this.prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(search && {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        onboardingCompleted: true,
        createdAt: true,
        subscription: {
          select: { tier: true, isTrialing: true },
        },
        _count: {
          select: { moodEntries: true, journalEntries: true, devices: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: Number(offset),
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user details' })
  @ApiResponse({ status: 200, description: 'User retrieved' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getById(@Param('id') id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        preferences: true,
        subscription: { include: { entitlements: true } },
        devices: true,
        _count: {
          select: {
            moodEntries: true,
            journalEntries: true,
            customRituals: true,
          },
        },
      },
    });
  }

  @Patch(':id/disable')
  @ApiOperation({ summary: 'Disable user' })
  @ApiResponse({ status: 200, description: 'User disabled' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async disable(@Param('id') id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }

  @Patch(':id/enable')
  @ApiOperation({ summary: 'Enable user' })
  @ApiResponse({ status: 200, description: 'User enabled' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async enable(@Param('id') id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { isActive: true },
    });
  }

  @Get(':id/export')
  @ApiOperation({ summary: 'Export user data (GDPR)' })
  @ApiResponse({ status: 200, description: 'Data exported' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async exportData(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        preferences: true,
        moodEntries: { where: { deletedAt: null } },
        journalEntries: { where: { deletedAt: null } },
        customRituals: { include: { steps: true } },
        ritualCompletions: true,
        devices: true,
      },
    });

    if (!user) return null;

    const { passwordHash, ...data } = user;
    return data;
  }

  @Post(':id/delete')
  @ApiOperation({ summary: 'Delete user (GDPR)' })
  @ApiResponse({ status: 201, description: 'User deleted' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async deleteUser(@Param('id') id: string) {
    // Soft delete and anonymize
    await this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
        email: null,
        name: null,
      },
    });

    // Delete sessions
    await this.prisma.session.deleteMany({
      where: { userId: id },
    });

    return { success: true };
  }
}
