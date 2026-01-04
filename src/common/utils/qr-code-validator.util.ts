import { BadRequestException } from '@nestjs/common';

export class QRCodeValidator {
  private static readonly QR_CODE_SUFFIX = 'syntax_move';
  private static readonly QR_CODE_VALIDITY_MINUTES = 5; // QR code valid for 5 minutes

  /**
   * Validate QR code format and timestamp
   * QR code format: ISO datetime string + "syntax_move"
   * Example: "2024-01-15T12:00:00.000Zsyntax_move"
   */
  static validateQRCode(
    qrCode: string,
    expectedDateTime: Date,
  ): { isValid: boolean; error?: string } {
    // Check if QR code ends with the required suffix
    if (!qrCode.endsWith(this.QR_CODE_SUFFIX)) {
      return {
        isValid: false,
        error: `QR code must end with "${this.QR_CODE_SUFFIX}"`,
      };
    }

    // Extract datetime from QR code
    const qrDateTimeString = qrCode.replace(this.QR_CODE_SUFFIX, '');
    let qrDateTime: Date;

    try {
      qrDateTime = new Date(qrDateTimeString);
    } catch (error) {
      return {
        isValid: false,
        error: 'Invalid datetime format in QR code',
      };
    }

    // Check if datetime is valid
    if (isNaN(qrDateTime.getTime())) {
      return {
        isValid: false,
        error: 'Invalid datetime in QR code',
      };
    }

    // Check if QR code datetime matches expected datetime (within tolerance)
    const timeDifference = Math.abs(
      qrDateTime.getTime() - expectedDateTime.getTime(),
    );
    const toleranceMs = this.QR_CODE_VALIDITY_MINUTES * 60 * 1000 * 1000;

    if (timeDifference > toleranceMs) {
      return {
        isValid: false,
        error: `QR code datetime does not match. Difference: ${Math.floor(
          timeDifference / 1000,
        )} seconds`,
      };
    }

    return { isValid: true };
  }

  /**
   * Generate QR code string from datetime
   * Used for testing or QR code generation
   */
  static generateQRCode(datetime: Date): string {
    return datetime.toISOString() + this.QR_CODE_SUFFIX;
  }
}

