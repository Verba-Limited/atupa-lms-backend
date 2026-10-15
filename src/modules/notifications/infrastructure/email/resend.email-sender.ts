import { Injectable } from '@nestjs/common';
import {
  EmailMessage,
  EmailSender,
} from '../../application/ports/notification.ports';

/** Resend REST adapter (https://resend.com/docs/api-reference/emails/send-email). */
@Injectable()
export class ResendEmailSender implements EmailSender {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `Resend responded ${response.status}: ${detail.slice(0, 200)}`,
      );
    }
  }
}
