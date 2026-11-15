export type SuspiciousFinding =
  'phone_number' | 'bank_details' | 'payment_link';

/** Nigerian mobile numbers, with or without +234 and separators. */
const PHONE = /(?:\+?234|0)[\s-]?[789][01](?:[\s-]?\d){8}\b/;
/** A 10-digit (NUBAN) account number near a bank word. */
const BANK_WORDS =
  /\b(account|acct|a\/c|bank|opay|palmpay|moniepoint|kuda|gtb|gtbank|access|zenith|uba|first ?bank|wema|fidelity|sterling|union bank|polaris|stanbic|transfer)\b/i;
const NUBAN = /\b\d{10}\b/;
const PAYMENT_LINK =
  /\b(paystack\.(com|shop)\/\S+|flutterwave\.com\/\S+|flw\.(ng|me)\/\S+|selar\.co\/\S+|paypal\.me\/\S+|wa\.me\/\S+|t\.me\/\S+|chat\.whatsapp\.com\/\S+|bit\.ly\/\S+)/i;

/**
 * Text that may be asking learners (often children) for money or moving
 * them off the platform: phone numbers, bank details and payment links.
 */
export function findSuspiciousText(text: string): SuspiciousFinding[] {
  const found: SuspiciousFinding[] = [];
  if (PHONE.test(text)) found.push('phone_number');
  if (BANK_WORDS.test(text) && NUBAN.test(text.replace(/[\s-]/g, ' '))) {
    found.push('bank_details');
  }
  if (PAYMENT_LINK.test(text)) found.push('payment_link');
  return found;
}
