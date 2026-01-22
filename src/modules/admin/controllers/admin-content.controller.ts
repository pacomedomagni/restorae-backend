import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ContentType, ContentStatus } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { PrismaService } from '../../../prisma/prisma.service';

@ApiTags('admin/content')
@Controller('admin/content')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminContentController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List all content' })
  async list(
    @Query('type') type?: ContentType,
    @Query('status') status?: ContentStatus,
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
  ) {
    return this.prisma.contentItem.findMany({
      where: {
        ...(type && { type }),
        ...(status && { status }),
      },
      include: { locales: true, audioFile: true },
      orderBy: [{ type: 'asc' }, { order: 'asc' }],
      take: limit,
      skip: offset,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get content by ID' })
  async getById(@Param('id') id: string) {
    return this.prisma.contentItem.findUnique({
      where: { id },
      include: { locales: true, audioFile: true },
    });
  }

  @Post()
  @ApiOperation({ summary: 'Create content' })
  async create(@Body() data: any) {
    return this.prisma.contentItem.create({
      data: {
        type: data.type,
        slug: data.slug,
        name: data.name,
        description: data.description,
        data: data.data || {},
        category: data.category,
        tags: data.tags || [],
        bestFor: data.bestFor,
        duration: data.duration,
        icon: data.icon,
        isPremium: data.isPremium || false,
        order: data.order || 0,
        status: data.status || ContentStatus.DRAFT,
      },
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update content' })
  async update(@Param('id') id: string, @Body() data: any) {
    return this.prisma.contentItem.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        data: data.data,
        category: data.category,
        tags: data.tags,
        bestFor: data.bestFor,
        duration: data.duration,
        icon: data.icon,
        isPremium: data.isPremium,
        order: data.order,
        status: data.status,
      },
    });
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish content' })
  async publish(@Param('id') id: string) {
    return this.prisma.contentItem.update({
      where: { id },
      data: {
        status: ContentStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });
  }

  @Post(':id/unpublish')
  @ApiOperation({ summary: 'Unpublish content' })
  async unpublish(@Param('id') id: string) {
    return this.prisma.contentItem.update({
      where: { id },
      data: { status: ContentStatus.DRAFT },
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete content' })
  async delete(@Param('id') id: string) {
    return this.prisma.contentItem.delete({
      where: { id },
    });
  }

  // Localization
  @Post(':id/locales')
  @ApiOperation({ summary: 'Add locale' })
  async addLocale(
    @Param('id') id: string,
    @Body() data: { locale: string; name: string; description: string; data?: any },
  ) {
    return this.prisma.contentLocale.create({
      data: {
        contentItemId: id,
        locale: data.locale,
        name: data.name,
        description: data.description,
        data: data.data,
      },
    });
  }

  @Patch(':id/locales/:locale')
  @ApiOperation({ summary: 'Update locale' })
  async updateLocale(
    @Param('id') id: string,
    @Param('locale') locale: string,
    @Body() data: { name?: string; description?: string; data?: any },
  ) {
    return this.prisma.contentLocale.updateMany({
      where: { contentItemId: id, locale },
      data,
    });
  }

  // Bulk operations
  @Post('import')
  @ApiOperation({ summary: 'Import content (JSON)' })
  async importContent(@Body() items: any[]) {
    const results = [];
    for (const item of items) {
      const result = await this.prisma.contentItem.upsert({
        where: { slug: item.slug },
        create: item,
        update: item,
      });
      results.push(result);
    }
    return { imported: results.length };
  }

  @Get('export')
  @ApiOperation({ summary: 'Export content (JSON)' })
  async exportContent(@Query('type') type?: ContentType) {
    return this.prisma.contentItem.findMany({
      where: type ? { type } : {},
      include: { locales: true },
    });
  }
}
