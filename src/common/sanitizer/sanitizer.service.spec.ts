import { Test, TestingModule } from '@nestjs/testing';
import { SanitizerService } from './sanitizer.service';

describe('SanitizerService', () => {
  let service: SanitizerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SanitizerService],
    }).compile();

    service = module.get<SanitizerService>(SanitizerService);
  });

  describe('escapeHtml', () => {
    it('should escape HTML entities', () => {
      expect(service.escapeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;'
      );
    });

    it('should handle empty strings', () => {
      expect(service.escapeHtml('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(service.escapeHtml(null as unknown as string)).toBe(null);
      expect(service.escapeHtml(undefined as unknown as string)).toBe(undefined);
    });

    it('should escape special characters', () => {
      expect(service.escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
      expect(service.escapeHtml('5 > 3')).toBe('5 &gt; 3');
      expect(service.escapeHtml('2 < 4')).toBe('2 &lt; 4');
    });
  });

  describe('removeDangerousPatterns', () => {
    it('should remove script tags', () => {
      expect(service.removeDangerousPatterns('<script>alert(1)</script>')).toBe('');
      expect(service.removeDangerousPatterns('Hello<script>alert(1)</script>World')).toBe('HelloWorld');
    });

    it('should remove javascript: URLs', () => {
      expect(service.removeDangerousPatterns('javascript:alert(1)')).toBe('alert(1)');
    });

    it('should remove event handlers', () => {
      expect(service.removeDangerousPatterns('onclick=alert(1)')).toBe('alert(1)');
      expect(service.removeDangerousPatterns('onerror=alert(1)')).toBe('alert(1)');
    });

    it('should remove iframe tags', () => {
      expect(service.removeDangerousPatterns('<iframe src="evil.com"></iframe>')).toBe(' src="evil.com">'));
    });

    it('should handle nested dangerous patterns', () => {
      const malicious = '<script><script>nested</script></script>';
      const result = service.removeDangerousPatterns(malicious);
      expect(result).not.toContain('<script');
    });
  });

  describe('sanitize', () => {
    it('should fully sanitize dangerous content', () => {
      const input = '<script>alert("xss")</script>Hello World';
      const result = service.sanitize(input);
      expect(result).toBe('Hello World');
      expect(result).not.toContain('script');
    });

    it('should preserve safe text', () => {
      const input = 'This is a safe journal entry about my day.';
      expect(service.sanitize(input)).toBe(input);
    });

    it('should handle complex XSS attempts', () => {
      const xssAttempts = [
        '<img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
        '<body onload=alert(1)>',
        '"><script>alert(1)</script>',
        "'-alert(1)-'",
        '<iframe src="javascript:alert(1)">',
      ];

      for (const attempt of xssAttempts) {
        const result = service.sanitize(attempt);
        expect(result).not.toContain('<script');
        expect(result).not.toMatch(/on\w+=/i);
        expect(result).not.toContain('javascript:');
      }
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize specified fields', () => {
      const input = {
        title: '<script>bad</script>Title',
        content: 'Safe content',
        id: 123,
      };

      const result = service.sanitizeObject(input, ['title', 'content']);
      expect(result.title).toBe('Title');
      expect(result.content).toBe('Safe content');
      expect(result.id).toBe(123);
    });
  });

  describe('sanitizeArray', () => {
    it('should sanitize all items in array', () => {
      const input = ['tag1', '<script>bad</script>tag2', 'tag3'];
      const result = service.sanitizeArray(input);
      expect(result).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should filter empty strings after sanitization', () => {
      const input = ['tag1', '<script></script>', 'tag2'];
      const result = service.sanitizeArray(input);
      expect(result).toEqual(['tag1', 'tag2']);
    });
  });

  describe('sanitizeEmail', () => {
    it('should lowercase and trim emails', () => {
      expect(service.sanitizeEmail('  Test@Example.COM  ')).toBe('test@example.com');
    });

    it('should remove XSS from emails', () => {
      expect(service.sanitizeEmail('<script>test@example.com</script>')).toBe('test@example.com');
    });
  });
});
