import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../common/email/email.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private readonly tokenExpiry = 60 * 60 * 1000; // 1 hour
  private readonly appUrl: string;
  private readonly fromEmail: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {
    this.appUrl = this.configService.get<string>('APP_URL') || 'https://app.restorae.com';
    this.fromEmail = this.configService.get<string>('FROM_EMAIL') || 'noreply@restorae.com';
  }

  /**
   * Request password reset - generates token and sends email
   */
  async requestReset(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always return success to prevent email enumeration
    if (!user || !user.isActive) {
      return { message: 'If an account exists with this email, you will receive a password reset link.' };
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + this.tokenExpiry);

    // Store token hash in database
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: tokenHash,
        passwordResetExpires: expiresAt,
      },
    });

    // Send email (non-blocking: token is saved even if email fails)
    try {
      await this.sendResetEmail(user.email!, user.name || 'there', token);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${email}:`, error);
    }

    this.logger.log(`Password reset requested for ${email}`);

    return { message: 'If an account exists with this email, you will receive a password reset link.' };
  }

  /**
   * Verify reset token is valid
   */
  async verifyToken(token: string): Promise<{ valid: boolean; email?: string }> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: tokenHash,
        passwordResetExpires: { gt: new Date() },
        isActive: true,
      },
      select: { email: true },
    });

    if (!user) {
      return { valid: false };
    }

    return { valid: true, email: user.email || undefined };
  }

  /**
   * Reset password with valid token
   */
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    if (newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: tokenHash,
        passwordResetExpires: { gt: new Date() },
        isActive: true,
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update user and clear reset token
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    // Invalidate all existing sessions for security
    await this.prisma.session.deleteMany({
      where: { userId: user.id },
    });

    this.logger.log(`Password reset completed for user ${user.id}`);

    // Send confirmation email (non-blocking: reset already succeeded)
    try {
      await this.sendPasswordChangedEmail(user.email!, user.name || 'there');
    } catch (error) {
      this.logger.error(`Failed to send password changed confirmation email to user ${user.id}:`, error);
    }

    return { message: 'Password reset successful. Please log in with your new password.' };
  }

  /**
   * Change password (for logged in users)
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, email: true, name: true },
    });

    if (!user || !user.passwordHash) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    if (newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Send confirmation email (non-blocking: password change already succeeded)
    if (user.email) {
      try {
        await this.sendPasswordChangedEmail(user.email, user.name || 'there');
      } catch (error) {
        this.logger.error(`Failed to send password changed confirmation email to user ${userId}:`, error);
      }
    }

    return { message: 'Password changed successfully' };
  }

  // =========================================================================
  // EMAIL SENDING
  // =========================================================================

  private async sendResetEmail(email: string, name: string, token: string): Promise<void> {
    const resetUrl = `${this.appUrl}/reset-password?token=${token}`;
    
    const emailContent = {
      to: email,
      from: this.fromEmail,
      subject: 'Reset your Restorae password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .logo { font-size: 24px; font-weight: bold; color: #7C3AED; }
            .button { display: inline-block; background: #7C3AED; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0; }
            .footer { margin-top: 40px; font-size: 12px; color: #666; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">Restorae</div>
            </div>
            <p>Hi ${name},</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <p style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #7C3AED;">${resetUrl}</p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this, you can safely ignore this email. Your password will not be changed.</p>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Restorae. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    await this.emailService.send(emailContent);
  }

  private async sendPasswordChangedEmail(email: string, name: string): Promise<void> {
    const emailContent = {
      to: email,
      from: this.fromEmail,
      subject: 'Your Restorae password was changed',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .logo { font-size: 24px; font-weight: bold; color: #7C3AED; }
            .footer { margin-top: 40px; font-size: 12px; color: #666; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">Restorae</div>
            </div>
            <p>Hi ${name},</p>
            <p>Your password has been successfully changed.</p>
            <p>If you did not make this change, please contact us immediately at support@restorae.com.</p>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Restorae. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    await this.emailService.send(emailContent);
  }
}
