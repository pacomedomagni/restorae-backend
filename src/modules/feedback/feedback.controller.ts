import { Controller, Get, Post, Patch, Body, UseGuards, UseInterceptors, Param } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { FeedbackType } from '@prisma/client';
import { FeedbackService } from './feedback.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserPayload } from '../../common/types/user-payload.interface';
import { SubmitFeedbackDto, UpdateFeedbackStatusDto } from './dto/feedback.dto';

@ApiTags('feedback')
@Controller('feedback')
export class FeedbackController {
  constructor(private feedbackService: FeedbackService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit feedback' })
  @ApiResponse({ status: 201, description: 'Feedback submitted' })
  submit(
    @CurrentUser() user: UserPayload,
    @Body() body: SubmitFeedbackDto,
  ) {
    return this.feedbackService.submit(user?.id, body);
  }

  @Post('anonymous')
  @ApiOperation({ summary: 'Submit anonymous feedback' })
  @ApiResponse({ status: 201, description: 'Feedback submitted' })
  submitAnonymous(
    @Body() body: SubmitFeedbackDto,
  ) {
    return this.feedbackService.submit(null, body);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my feedback' })
  @ApiResponse({ status: 200, description: 'Feedback retrieved' })
  getMyFeedback(@CurrentUser() user: UserPayload) {
    return this.feedbackService.getUserFeedback(user.id);
  }

  @Get('faq')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(3600)
  @ApiOperation({ summary: 'Get FAQs' })
  @ApiResponse({ status: 200, description: 'FAQs retrieved' })
  getFAQs() {
    return this.feedbackService.getFAQs();
  }
}

// Admin endpoints
@ApiTags('admin/feedback')
@Controller('admin/feedback')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminFeedbackController {
  constructor(private feedbackService: FeedbackService) {}

  @Get()
  @ApiOperation({ summary: 'Get all feedback' })
  @ApiResponse({ status: 200, description: 'Feedback retrieved' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  getAllFeedback() {
    return this.feedbackService.getAllFeedback();
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update feedback status' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  @ApiResponse({ status: 404, description: 'Not found' })
  updateStatus(@Param('id') id: string, @Body() body: UpdateFeedbackStatusDto) {
    return this.feedbackService.updateStatus(id, body.status);
  }
}
