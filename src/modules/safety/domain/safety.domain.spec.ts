import {
  allowedOutcomes,
  ReportOutcome,
  ReportReason,
  responseDeadline,
  severityOf,
} from './safety-report.entity';
import { findSuspiciousText } from './suspicious-text';

describe('safety reports', () => {
  it('treats child-safety reasons as critical with a 24 hour deadline', () => {
    expect(severityOf(ReportReason.ASKING_FOR_MONEY_OR_DETAILS)).toBe(
      'critical',
    );
    expect(severityOf(ReportReason.INAPPROPRIATE_MESSAGES)).toBe('critical');
    expect(severityOf(ReportReason.COPIED_CONTENT)).toBe('normal');
    const from = new Date('2026-11-15T10:00:00Z');
    expect(responseDeadline('critical', from).toISOString()).toBe(
      '2026-11-16T10:00:00.000Z',
    );
  });

  it('only offers outcomes that fit the target', () => {
    expect(allowedOutcomes('course')).toContain(ReportOutcome.HIDE_COURSE);
    expect(allowedOutcomes('teacher')).not.toContain(ReportOutcome.HIDE_COURSE);
    expect(allowedOutcomes('school')).not.toContain(
      ReportOutcome.SUSPEND_ACCOUNT,
    );
  });
});

describe('suspicious text', () => {
  it('finds phone numbers, bank details and payment links', () => {
    expect(findSuspiciousText('Call me on 0803 123 4567')).toEqual([
      'phone_number',
    ]);
    expect(findSuspiciousText('WhatsApp +2348031234567 today')).toEqual([
      'phone_number',
    ]);
    expect(
      findSuspiciousText('Pay to GTBank account 0123456789 for extra lessons'),
    ).toEqual(['bank_details']);
    expect(findSuspiciousText('Pay here https://paystack.com/pay/xyz')).toEqual(
      ['payment_link'],
    );
  });

  it('ignores normal lesson text', () => {
    expect(
      findSuspiciousText('Ẹ kú àárọ̀ means good morning. Count 1 2 3 4 5.'),
    ).toEqual([]);
    expect(findSuspiciousText('The year 2014 and 100 learners')).toEqual([]);
  });
});
