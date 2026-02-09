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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ContentType, ContentStatus, Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateContentDto, UpdateContentDto, AddLocaleDto, UpdateLocaleDto } from '../dto';

@ApiTags('admin/content')
@Controller('admin/content')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminContentController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List all content' })
  @ApiResponse({ status: 200, description: 'Content list retrieved' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
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
      take: Number(limit),
      skip: Number(offset),
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get content by ID' })
  @ApiResponse({ status: 200, description: 'Content item retrieved' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getById(@Param('id') id: string) {
    return this.prisma.contentItem.findUnique({
      where: { id },
      include: { locales: true, audioFile: true },
    });
  }

  @Post()
  @ApiOperation({ summary: 'Create content' })
  @ApiResponse({ status: 201, description: 'Content created' })
  async create(@Body() data: CreateContentDto) {
    return this.prisma.contentItem.create({
      data: {
        type: data.type,
        slug: data.slug,
        name: data.name,
        description: data.description || '',
        data: data.data || {},
        category: data.category,
        tags: data.tags || [],
        bestFor: data.bestFor,
        duration: data.duration ? String(data.duration) : null,
        icon: data.icon,
        isPremium: data.isPremium || false,
        order: data.order || 0,
        status: data.status || ContentStatus.DRAFT,
      },
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update content' })
  @ApiResponse({ status: 200, description: 'Content updated' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async update(@Param('id') id: string, @Body() data: UpdateContentDto) {
    return this.prisma.contentItem.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        data: data.data,
        category: data.category,
        tags: data.tags,
        bestFor: data.bestFor,
        duration: data.duration !== undefined ? String(data.duration) : undefined,
        icon: data.icon,
        isPremium: data.isPremium,
        order: data.order,
        status: data.status,
      },
    });
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish content' })
  @ApiResponse({ status: 201, description: 'Content published' })
  @ApiResponse({ status: 404, description: 'Not found' })
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
  @ApiResponse({ status: 201, description: 'Content unpublished' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async unpublish(@Param('id') id: string) {
    return this.prisma.contentItem.update({
      where: { id },
      data: { status: ContentStatus.DRAFT },
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete content' })
  @ApiResponse({ status: 200, description: 'Content deleted' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async delete(@Param('id') id: string) {
    return this.prisma.contentItem.delete({
      where: { id },
    });
  }

  // Localization
  @Post(':id/locales')
  @ApiOperation({ summary: 'Add locale' })
  @ApiResponse({ status: 201, description: 'Locale added' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async addLocale(
    @Param('id') id: string,
    @Body() data: AddLocaleDto,
  ) {
    return this.prisma.contentLocale.create({
      data: {
        contentItemId: id,
        locale: data.locale,
        name: data.name,
        description: data.description,
        data: data.data as Prisma.InputJsonValue,
      },
    });
  }

  @Patch(':id/locales/:locale')
  @ApiOperation({ summary: 'Update locale' })
  @ApiResponse({ status: 200, description: 'Locale updated' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async updateLocale(
    @Param('id') id: string,
    @Param('locale') locale: string,
    @Body() data: UpdateLocaleDto,
  ) {
    return this.prisma.contentLocale.updateMany({
      where: { contentItemId: id, locale },
      data: data as Prisma.ContentLocaleUpdateManyMutationInput,
    });
  }

  // Bulk operations
  @Post('import')
  @ApiOperation({ summary: 'Import content (JSON)' })
  @ApiResponse({ status: 201, description: 'Content imported' })
  async importContent(@Body() items: CreateContentDto[]) {
    const results = [];
    for (const item of items) {
      const result = await this.prisma.contentItem.upsert({
        where: { slug: item.slug },
        create: item as unknown as Prisma.ContentItemCreateInput,
        update: item as unknown as Prisma.ContentItemUpdateInput,
      });
      results.push(result);
    }
    return { imported: results.length };
  }

  @Get('export')
  @ApiOperation({ summary: 'Export content (JSON)' })
  @ApiResponse({ status: 200, description: 'Content exported' })
  async exportContent(@Query('type') type?: ContentType) {
    return this.prisma.contentItem.findMany({
      where: type ? { type } : {},
      include: { locales: true },
    });
  }
}
