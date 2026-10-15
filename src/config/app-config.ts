import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Typed accessor over environment configuration. */
@Injectable()
export class AppConfig {
  constructor(private readonly config: ConfigService) {}

  get isProduction(): boolean {
    return this.config.get('NODE_ENV') === 'production';
  }

  get apiBaseUrl(): string {
    return this.config.get('APP_BASE_URL') ?? 'http://localhost:4000';
  }

  /** Where the learner-facing web app lives (links in emails, QR codes). */
  get frontendUrl(): string {
    return this.config.get('FRONTEND_URL') ?? 'http://localhost:3000';
  }

  get corsOrigins(): string[] | true {
    const raw = this.config.get<string>('CORS_ORIGINS');
    if (!raw) return true;
    return raw
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
  }

  get jwt() {
    return {
      accessSecret: this.config.getOrThrow<string>('JWT_SECRET'),
      refreshSecret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      accessTtlSeconds: parseDuration(
        this.config.get<string>('JWT_EXPIRES_IN') ?? '15m',
      ),
      refreshTtlSeconds: parseDuration(
        this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d',
      ),
    };
  }

  get superAdminBootstrap(): { email: string; password: string } | null {
    const email = this.config.get<string>('SUPER_ADMIN_EMAIL');
    const password = this.config.get<string>('SUPER_ADMIN_PASSWORD');
    return email && password ? { email, password } : null;
  }

  get resend() {
    return {
      apiKey: this.config.get<string>('RESEND_API_KEY'),
      from:
        this.config.get<string>('EMAIL_FROM') ??
        'ATUPA LMS <no-reply@atupa.ng>',
    };
  }

  get paystack() {
    return {
      secretKey: this.config.get<string>('PAYSTACK_SECRET_KEY'),
      publicKey: this.config.get<string>('PAYSTACK_PUBLIC_KEY'),
      baseUrl:
        this.config.get<string>('PAYSTACK_BASE_URL') ??
        'https://api.paystack.co',
    };
  }

  get cloudinary() {
    return {
      cloudName: this.config.get<string>('CLOUDINARY_CLOUD_NAME'),
      apiKey: this.config.get<string>('CLOUDINARY_API_KEY'),
      apiSecret: this.config.get<string>('CLOUDINARY_API_SECRET'),
      folder: this.config.get<string>('CLOUDINARY_FOLDER') ?? 'atupa-lms',
    };
  }

  get mediaUploadDir(): string {
    return this.config.get<string>('MEDIA_UPLOAD_DIR') ?? 'uploads';
  }

  get seedDemoContent(): boolean {
    return this.config.get<string>('SEED_DEMO_CONTENT') !== 'false';
  }

  get remindersEnabled(): boolean {
    return this.config.get<string>('LEARNING_REMINDERS_ENABLED') !== 'false';
  }
}

/** Parses "900", "15m", "12h", "7d" into seconds. */
export function parseDuration(value: string): number {
  const match = /^(\d+)\s*([smhd]?)$/.exec(value.trim());
  if (!match) throw new Error(`Invalid duration: ${value}`);
  const amount = Number(match[1]);
  const unit = match[2] || 's';
  const factor = { s: 1, m: 60, h: 3600, d: 86400 }[unit] ?? 1;
  return amount * factor;
}
