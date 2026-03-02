import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt, randomUUID } from 'crypto';

interface VerifyRequestResult {
  verificationId: string;
  devOtpCode?: string;
}

interface LocalVerification {
  code: string;
  phone: string;
  expiresAt: number;
}

@Injectable()
export class MessageBirdVerifyService {
  private readonly localVerifications = new Map<string, LocalVerification>();

  constructor(private readonly config: ConfigService) {}

  async requestOtp(phone: string): Promise<VerifyRequestResult> {
    const accessKey = this.config.get<string>('MESSAGEBIRD_ACCESS_KEY');
    if (!accessKey) {
      return this.createLocalVerification(phone);
    }

    const response = await fetch('https://rest.messagebird.com/verify', {
      method: 'POST',
      headers: {
        Authorization: `AccessKey ${accessKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        recipient: phone,
        originator: this.config.get<string>('MESSAGEBIRD_VERIFY_ORIGINATOR') ?? 'HikmahOne',
        body:
          this.config.get<string>('MESSAGEBIRD_VERIFY_TEMPLATE')
          ?? 'Your HikmahOne verification code is %token.',
        timeout: String(this.getTimeoutSeconds()),
      }),
    });

    const payload = await this.readPayload(response);

    if (!response.ok || typeof payload.id !== 'string') {
      throw new ServiceUnavailableException(this.extractErrorMessage(payload) ?? 'Unable to send OTP');
    }

    return {
      verificationId: payload.id,
    };
  }

  async verifyOtp(verificationId: string, phone: string, otpCode: string): Promise<void> {
    const accessKey = this.config.get<string>('MESSAGEBIRD_ACCESS_KEY');
    if (!accessKey) {
      this.verifyLocalCode(verificationId, phone, otpCode);
      return;
    }

    const encodedToken = encodeURIComponent(otpCode.trim());
    const response = await fetch(`https://rest.messagebird.com/verify/${verificationId}?token=${encodedToken}`, {
      method: 'GET',
      headers: {
        Authorization: `AccessKey ${accessKey}`,
      },
    });

    const payload = await this.readPayload(response);

    if (!response.ok) {
      throw new UnauthorizedException(this.extractErrorMessage(payload) ?? 'OTP verification failed');
    }
  }

  private createLocalVerification(phone: string): VerifyRequestResult {
    const verificationId = randomUUID();
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');

    this.localVerifications.set(verificationId, {
      code,
      phone,
      expiresAt: Date.now() + this.getTimeoutSeconds() * 1000,
    });

    return {
      verificationId,
      devOtpCode: code,
    };
  }

  private verifyLocalCode(verificationId: string, phone: string, otpCode: string): void {
    const local = this.localVerifications.get(verificationId);
    if (!local) {
      throw new UnauthorizedException('OTP session not found');
    }

    if (local.expiresAt < Date.now()) {
      this.localVerifications.delete(verificationId);
      throw new UnauthorizedException('OTP session expired');
    }

    if (local.phone !== phone || local.code !== otpCode.trim()) {
      throw new UnauthorizedException('Invalid OTP code');
    }

    this.localVerifications.delete(verificationId);
  }

  private getTimeoutSeconds(): number {
    const raw = this.config.get<string>('MESSAGEBIRD_VERIFY_TIMEOUT_SECONDS');
    const parsed = Number.parseInt(raw ?? '', 10);

    if (Number.isFinite(parsed) && parsed >= 30) {
      return parsed;
    }

    return 300;
  }

  private async readPayload(response: Response): Promise<Record<string, unknown>> {
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      return {};
    }

    try {
      return (await response.json()) as Record<string, unknown>;
    } catch {
      throw new InternalServerErrorException('Failed to parse OTP provider response');
    }
  }

  private extractErrorMessage(payload: Record<string, unknown>): string | null {
    const errors = payload.errors;
    if (!Array.isArray(errors)) {
      return null;
    }

    const detail = errors.find(
      (item): item is { description?: string } =>
        typeof item === 'object' && item !== null && 'description' in item,
    );

    return detail?.description ?? null;
  }
}
