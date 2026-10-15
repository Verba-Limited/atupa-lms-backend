import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { QrCodeGenerator } from '../../application/qr-code.port';

@Injectable()
export class QrCodePngGenerator implements QrCodeGenerator {
  toDataUrl(text: string): Promise<string> {
    return QRCode.toDataURL(text, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 256,
    });
  }
}
