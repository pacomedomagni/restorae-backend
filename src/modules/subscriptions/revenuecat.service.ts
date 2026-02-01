import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface RevenueCatSubscriber {
  subscriber: {
    entitlements: Record<string, {
      product_identifier: string;
      expires_date: string | null;
      purchase_date: string;
    }>;
    subscriptions: Record<string, {
      product_identifier: string;
      expires_date: string | null;
      purchase_date: string;
      is_sandbox: boolean;
      unsubscribe_detected_at: string | null;
      billing_issues_detected_at: string | null;
    }>;
    non_subscriptions: Record<string, Array<{
      id: string;
      purchase_date: string;
    }>>;
    first_seen: string;
    original_app_user_id: string;
  };
}

interface ValidateReceiptResult {
  isValid: boolean;
  productId?: string;
  expiresAt?: Date;
  isTrialing?: boolean;
  isSandbox?: boolean;
  entitlements?: string[];
}

@Injectable()
export class RevenueCatService {
  private readonly logger = new Logger(RevenueCatService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.revenuecat.com/v1';

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('REVENUECAT_API_KEY') || '';
    
    if (!this.apiKey) {
      this.logger.warn('REVENUECAT_API_KEY not configured. In-app purchases will not work.');
    }
  }

  private get headers() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'X-Platform': 'ios', // or 'android' based on request
    };
  }

  /**
   * Get subscriber info from RevenueCat
   */
  async getSubscriber(appUserId: string): Promise<RevenueCatSubscriber | null> {
    if (!this.apiKey) {
      this.logger.warn('RevenueCat API key not configured');
      return null;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/subscribers/${encodeURIComponent(appUserId)}`,
        {
          method: 'GET',
          headers: this.headers,
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`RevenueCat API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      this.logger.error(`Failed to get subscriber ${appUserId}:`, error);
      throw error;
    }
  }

  /**
   * Validate a receipt and get subscription status
   */
  async validateReceipt(
    appUserId: string,
    receiptData: string,
    platform: 'ios' | 'android',
    productId?: string
  ): Promise<ValidateReceiptResult> {
    if (!this.apiKey) {
      if (process.env.NODE_ENV === 'production') {
        this.logger.error('RevenueCat API key not configured in production; refusing receipt validation');
        return { isValid: false };
      }

      this.logger.warn('RevenueCat API key not configured, using mock validation (non-production only)');
      return {
        isValid: true,
        productId: productId || 'com.restorae.premium.monthly',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isTrialing: false,
        isSandbox: true,
        entitlements: ['premium'],
      };
    }

    try {
      // Post receipt to RevenueCat
      const endpoint = platform === 'ios' 
        ? `${this.baseUrl}/receipts`
        : `${this.baseUrl}/receipts`;

      const body = platform === 'ios' 
        ? {
            app_user_id: appUserId,
            fetch_token: receiptData,
            product_id: productId,
          }
        : {
            app_user_id: appUserId,
            product_id: productId,
            token: receiptData,
          };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          ...this.headers,
          'X-Platform': platform,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        this.logger.error('Receipt validation failed:', error);
        return { isValid: false };
      }

      const data: RevenueCatSubscriber = await response.json();
      
      // Check for premium entitlement
      const premiumEntitlement = data.subscriber.entitlements['premium'];
      if (premiumEntitlement) {
        return {
          isValid: true,
          productId: premiumEntitlement.product_identifier,
          expiresAt: premiumEntitlement.expires_date 
            ? new Date(premiumEntitlement.expires_date) 
            : undefined,
          isTrialing: false,
          isSandbox: Object.values(data.subscriber.subscriptions).some(s => s.is_sandbox),
          entitlements: Object.keys(data.subscriber.entitlements),
        };
      }

      // Check for lifetime purchase
      const lifetimePurchases = data.subscriber.non_subscriptions['com.restorae.premium.lifetime'];
      if (lifetimePurchases?.length > 0) {
        return {
          isValid: true,
          productId: 'com.restorae.premium.lifetime',
          expiresAt: undefined, // Lifetime has no expiry
          isTrialing: false,
          isSandbox: false,
          entitlements: ['premium', 'lifetime'],
        };
      }

      return { isValid: false };
    } catch (error) {
      this.logger.error('Receipt validation error:', error);
      return { isValid: false };
    }
  }

  /**
   * Restore purchases for a user
   */
  async restorePurchases(appUserId: string): Promise<ValidateReceiptResult> {
    const subscriber = await this.getSubscriber(appUserId);
    
    if (!subscriber) {
      return { isValid: false };
    }

    // Check for active entitlements
    const entitlements = subscriber.subscriber.entitlements;
    const premiumEntitlement = entitlements['premium'];

    if (premiumEntitlement) {
      const expiresDate = premiumEntitlement.expires_date 
        ? new Date(premiumEntitlement.expires_date)
        : null;

      // Check if subscription is still valid
      if (!expiresDate || expiresDate > new Date()) {
        return {
          isValid: true,
          productId: premiumEntitlement.product_identifier,
          expiresAt: expiresDate || undefined,
          entitlements: Object.keys(entitlements),
        };
      }
    }

    return { isValid: false };
  }

  /**
   * Grant a promotional entitlement
   */
  async grantPromotional(
    appUserId: string,
    entitlementId: string,
    durationDays: number
  ): Promise<boolean> {
    if (!this.apiKey) {
      this.logger.warn('RevenueCat API key not configured');
      return true; // Return success in development
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/subscribers/${encodeURIComponent(appUserId)}/entitlements/${entitlementId}/promotional`,
        {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({
            duration: 'custom',
            duration_days: durationDays,
          }),
        }
      );

      return response.ok;
    } catch (error) {
      this.logger.error('Failed to grant promotional:', error);
      return false;
    }
  }

  /**
   * Revoke a promotional entitlement
   */
  async revokePromotional(appUserId: string, entitlementId: string): Promise<boolean> {
    if (!this.apiKey) {
      return true;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/subscribers/${encodeURIComponent(appUserId)}/entitlements/${entitlementId}/revoke_promotionals`,
        {
          method: 'POST',
          headers: this.headers,
        }
      );

      return response.ok;
    } catch (error) {
      this.logger.error('Failed to revoke promotional:', error);
      return false;
    }
  }

  /**
   * Transfer purchases from anonymous to identified user
   */
  async transferPurchases(
    anonymousUserId: string,
    identifiedUserId: string
  ): Promise<boolean> {
    if (!this.apiKey) {
      return true;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/subscribers/${encodeURIComponent(identifiedUserId)}/alias`,
        {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({
            new_app_user_id: anonymousUserId,
          }),
        }
      );

      return response.ok;
    } catch (error) {
      this.logger.error('Failed to transfer purchases:', error);
      return false;
    }
  }
}
