import { Injectable, Logger } from '@nestjs/common';
import {
  EmailMessage,
  EmailSender,
} from '../../application/ports/notification.ports';

/**
 * Development fallback when RESEND_API_KEY is not set. Prints emails (with
 * their links) to the log so flows like password reset can be tested.
 * In production it only logs that an email was skipped.
 */
@Injectable()
export class ConsoleEmailSender implements EmailSender {
  private readonly logger = new Logger('Email');

  constructor(private readonly verbose: boolean) {}

  send(message: EmailMessage): Promise<void> {
    if (this.verbose) {
      this.logger.log(
        `To: ${message.to} | ${message.subject}\n${message.text}`,
      );
    } else {
      this.logger.warn(
        `Email not sent (RESEND_API_KEY missing): "${message.subject}"`,
      );
    }
    return Promise.resolve();
  }
}
