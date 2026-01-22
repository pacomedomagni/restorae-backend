import { Controller, Get, Post, Patch, Body, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FeedbackType } from '@prisma/client';
import { FeedbackService } from './feedback.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('feedback')
@Controller('feedback')
export class FeedbackController {
  constructor(private feedbackService: FeedbackService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit feedback' })
  submit(
    @CurrentUser() user: any,
    @Body() body: {
      type: FeedbackType;
      subject?: string;
      message: string;
      email?: string;
      deviceInfo?: any;
    },
  ) {
    return this.feedbackService.submit(user?.id, body);
  }

  @Post('anonymous')
  @ApiOperation({ summary: 'Submit anonymous feedback' })
  submitAnonymous(
    @Body() body: {
      type: FeedbackType;
      subject?: string;
      message: string;
      email?: string;
      deviceInfo?: any;
    },
  ) {
    return this.feedbackService.submit(null, body);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my feedback' })
  getMyFeedback(@CurrentUser() user: any) {
    return this.feedbackService.getUserFeedback(user.id);
  }

  @Get('faq')
  @ApiOperation({ summary: 'Get FAQs' })
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
  getAllFeedback() {
    return this.feedbackService.getAllFeedback();
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update feedback status' })
  updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.feedbackService.updateStatus(id, body.status);
  }
}
