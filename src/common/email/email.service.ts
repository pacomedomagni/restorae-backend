import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface EmailOptions {
  to: string;
  from?: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly fromEmail: string;
  private readonly isConfigured: boolean;

  constructor(private configService: ConfigService) {
    this.fromEmail = this.configService.get<string>('EMAIL_FROM') || 'noreply@restorae.com';

    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpPort = this.configService.get<number>('SMTP_PORT');
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');

    if (smtpHost && smtpUser && smtpPass) {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort || 587,
        secure: (smtpPort || 587) === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
      this.isConfigured = true;
      this.logger.log('Email service configured with SMTP transport');
    } else {
      this.isConfigured = false;
      this.logger.warn('Email service not configured — emails will be logged only. Set SMTP_HOST, SMTP_USER, SMTP_PASS to enable.');
    }
  }

  async send(options: EmailOptions): Promise<boolean> {
    const from = options.from || this.fromEmail;

    if (!this.isConfigured || !this.transporter) {
      this.logger.log(`[DEV] Email to ${options.to}: "${options.subject}"`);
      return true;
    }

    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.transporter.sendMail({
          from,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        });
        this.logger.log(`Email sent to ${options.to}: "${options.subject}"`);
        return true;
      } catch (error) {
        this.logger.error(
          `Failed to send email to ${options.to} (attempt ${attempt}/${maxRetries}):`,
          error,
        );

        if (attempt < maxRetries) {
          const delayMs = Math.pow(2, attempt) * 500; // 1s, 2s, 4s
          this.logger.log(`Retrying email send in ${delayMs}ms...`);
          await this.delay(delayMs);
        }
      }
    }

    this.logger.error(
      `All ${maxRetries} attempts to send email to ${options.to} failed. Giving up.`,
    );
    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
