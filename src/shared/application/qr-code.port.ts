export const QR_CODE_GENERATOR = Symbol('QR_CODE_GENERATOR');

export interface QrCodeGenerator {
  /** PNG data URL encoding `text`. */
  toDataUrl(text: string): Promise<string>;
}
