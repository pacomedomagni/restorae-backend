import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface FCMMessage {
  token: string;
  notification?: {
    title: string;
    body: string;
    imageUrl?: string;
  };
  data?: Record<string, string>;
  android?: {
    priority?: 'high' | 'normal';
    ttl?: string;
    notification?: {
      icon?: string;
      color?: string;
      sound?: string;
      channelId?: string;
    };
  };
  apns?: {
    headers?: Record<string, string>;
    payload?: {
      aps?: {
        sound?: string;
        badge?: number;
        category?: string;
        'content-available'?: number;
        'mutable-content'?: number;
      };
    };
  };
}

interface FCMMulticastMessage {
  tokens: string[];
  notification?: {
    title: string;
    body: string;
  };
  data?: Record<string, string>;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface FirebaseServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
}

interface FCMErrorDetail {
  errorCode?: string;
  [key: string]: unknown;
}

interface MulticastResult {
  successCount: number;
  failureCount: number;
  responses: SendResult[];
}

@Injectable()
export class FirebaseMessagingService {
  private readonly logger = new Logger(FirebaseMessagingService.name);
  private readonly projectId: string;
  private readonly serviceAccountKey: FirebaseServiceAccountKey | null = null;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(private configService: ConfigService) {
    this.projectId = this.configService.get<string>('FIREBASE_PROJECT_ID') || '';
    
    const serviceAccountJson = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT');
    if (serviceAccountJson) {
      try {
        this.serviceAccountKey = JSON.parse(serviceAccountJson) as FirebaseServiceAccountKey;
      } catch {
        this.logger.warn('Invalid FIREBASE_SERVICE_ACCOUNT JSON');
      }
    }

    if (!this.projectId || !this.serviceAccountKey) {
      this.logger.warn('Firebase not configured. Push notifications will be logged but not sent.');
    }
  }

  /**
   * Get OAuth2 access token for FCM
   */
  private async getAccessToken(): Promise<string | null> {
    if (!this.serviceAccountKey) {
      return null;
    }

    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    try {
      // Create JWT for service account
      const jwt = await this.createJWT();
      
      // Exchange JWT for access token
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: jwt,
        }),
      });

      if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.status}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = new Date(Date.now() + (data.expires_in - 60) * 1000);
      
      return this.accessToken;
    } catch (error) {
      this.logger.error('Failed to get access token:', error);
      return null;
    }
  }

  /**
   * Create JWT for service account authentication
   */
  private async createJWT(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 3600;

    const header = {
      alg: 'RS256',
      typ: 'JWT',
    };

    const payload = {
      iss: this.serviceAccountKey!.client_email,
      sub: this.serviceAccountKey!.client_email,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: exp,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
    };

    // In production, use proper JWT library like jsonwebtoken
    // For now, use Node's crypto for signing
    const crypto = await import('crypto');
    
    const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
    const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signatureInput = `${base64Header}.${base64Payload}`;
    
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signatureInput);
    const signature = sign.sign(this.serviceAccountKey!.private_key, 'base64url');

    return `${signatureInput}.${signature}`;
  }

  /**
   * Send notification to a single device
   */
  async send(message: FCMMessage): Promise<SendResult> {
    // Log for development
    this.logger.debug('Sending FCM message:', {
      token: message.token.substring(0, 20) + '...',
      title: message.notification?.title,
    });

    const accessToken = await this.getAccessToken();
    
    if (!accessToken) {
      this.logger.warn('FCM not configured, notification logged but not sent');
      return { 
        success: true, 
        messageId: `mock-${Date.now()}`,
      };
    }

    try {
      const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        this.logger.error('FCM send failed:', error);
        
        // Handle token errors
        if (error.error?.details?.some((d: FCMErrorDetail) =>
          d.errorCode === 'UNREGISTERED' || d.errorCode === 'INVALID_ARGUMENT'
        )) {
          return { 
            success: false, 
            error: 'INVALID_TOKEN',
          };
        }
        
        return { 
          success: false, 
          error: error.error?.message || 'Unknown error',
        };
      }

      const result = await response.json();
      return { 
        success: true, 
        messageId: result.name,
      };
    } catch (error) {
      this.logger.error('FCM send error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send notification to multiple devices
   */
  async sendMulticast(message: FCMMulticastMessage): Promise<MulticastResult> {
    const results: SendResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    // FCM v1 doesn't have native multicast, send individually
    // In production, consider using batching or worker queues
    for (const token of message.tokens) {
      const result = await this.send({
        token,
        notification: message.notification,
        data: message.data,
      });

      results.push(result);
      if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    return {
      successCount,
      failureCount,
      responses: results,
    };
  }

  /**
   * Send notification with iOS and Android specific configs
   */
  async sendRich(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
    options?: {
      imageUrl?: string;
      badge?: number;
      sound?: string;
      channelId?: string;
    }
  ): Promise<SendResult> {
    const message: FCMMessage = {
      token,
      notification: {
        title,
        body,
        imageUrl: options?.imageUrl,
      },
      data,
      android: {
        priority: 'high',
        notification: {
          icon: 'ic_notification',
          color: '#7C3AED',
          sound: options?.sound || 'default',
          channelId: options?.channelId || 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: options?.sound || 'default',
            badge: options?.badge,
            'mutable-content': 1,
          },
        },
      },
    };

    return this.send(message);
  }

  /**
   * Send silent/data-only notification
   */
  async sendData(
    token: string,
    data: Record<string, string>
  ): Promise<SendResult> {
    const message: FCMMessage = {
      token,
      data,
      android: {
        priority: 'high',
      },
      apns: {
        payload: {
          aps: {
            'content-available': 1,
          },
        },
      },
    };

    return this.send(message);
  }
}
