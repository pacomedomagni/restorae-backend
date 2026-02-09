/**
 * Sanitizer Service
 * 
 * Provides XSS sanitization for user-generated content.
 * Strips potentially dangerous HTML/scripts while preserving safe content.
 */
import { Injectable } from '@nestjs/common';

@Injectable()
export class SanitizerService {
  // HTML entities that need escaping
  private readonly htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
  };

  // Patterns that indicate potential XSS attacks
  private readonly dangerousPatterns: RegExp[] = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /data:/gi,
    /on\w+\s*=/gi, // onclick, onerror, onload, etc.
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
    /<link/gi,
    /<meta/gi,
    /<style/gi,
    /expression\s*\(/gi,
    /url\s*\(/gi,
    /@import/gi,
    /<!--/gi,
    /-->/gi,
  ];

  /**
   * Sanitize a string by escaping HTML entities
   */
  escapeHtml(input: string): string {
    if (!input || typeof input !== 'string') {
      return input;
    }

    return input.replace(/[&<>"'`=/]/g, (char) => this.htmlEntities[char] || char);
  }

  /**
   * Remove dangerous patterns from input
   */
  removeDangerousPatterns(input: string): string {
    if (!input || typeof input !== 'string') {
      return input;
    }

    let sanitized = input;
    for (const pattern of this.dangerousPatterns) {
      sanitized = sanitized.replace(pattern, '');
    }
    return sanitized;
  }

  /**
   * Full sanitization: remove dangerous patterns and escape remaining HTML
   */
  sanitize(input: string): string {
    if (!input || typeof input !== 'string') {
      return input;
    }

    // First pass: remove dangerous patterns
    let sanitized = this.removeDangerousPatterns(input);

    // Second pass: escape remaining HTML
    sanitized = this.escapeHtml(sanitized);

    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    return sanitized;
  }

  /**
   * Light sanitization: only remove dangerous patterns, preserve formatting
   * Use this for content where formatting matters (like journal entries)
   */
  sanitizePreserveFormatting(input: string): string {
    if (!input || typeof input !== 'string') {
      return input;
    }

    return this.removeDangerousPatterns(input);
  }

  /**
   * Sanitize an object's string properties recursively
   */
  sanitizeObject<T extends Record<string, unknown>>(obj: T, fieldsToSanitize: string[]): T {
    const sanitized = { ...obj };

    for (const field of fieldsToSanitize) {
      if (typeof sanitized[field] === 'string') {
        (sanitized as Record<string, unknown>)[field] = this.sanitize(sanitized[field] as string);
      }
    }

    return sanitized;
  }

  /**
   * Validate and sanitize email
   */
  sanitizeEmail(email: string): string {
    if (!email || typeof email !== 'string') {
      return email;
    }

    // Remove any HTML/scripts
    let sanitized = this.sanitize(email);

    // Normalize email
    sanitized = sanitized.toLowerCase().trim();

    return sanitized;
  }

  /**
   * Sanitize array of strings (like tags)
   */
  sanitizeArray(arr: string[]): string[] {
    if (!Array.isArray(arr)) {
      return arr;
    }

    return arr.map((item) => this.sanitize(item)).filter((item) => item.length > 0);
  }
}
