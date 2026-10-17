import crypto from 'crypto';

export interface VerifyGithubSignatureOptions {
  rawBody: string;
  signatureHeader: string | null;
  secret: string;
}

export interface VerifyGithubSignatureResult {
  isValid: boolean;
  reason?: string;
}

/**
 * Verifies a GitHub Webhook delivery signature (X-Hub-Signature-256)
 * using timing-safe comparison to prevent timing attacks.
 *
 * Official Reference: https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
 */
export function verifyGithubSignature({
  rawBody,
  signatureHeader,
  secret,
}: VerifyGithubSignatureOptions): VerifyGithubSignatureResult {
  if (!signatureHeader) {
    return { isValid: false, reason: 'missing_signature_header' };
  }

  if (!secret) {
    return { isValid: false, reason: 'missing_webhook_secret' };
  }

  // Header format is sha256=<hex_digest>
  if (!signatureHeader.startsWith('sha256=')) {
    return { isValid: false, reason: 'invalid_signature_prefix' };
  }

  const signature = signatureHeader.slice('sha256='.length);

  try {
    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody, 'utf8')
      .digest('hex');

    const expectedBuffer = Buffer.from(computedSignature, 'hex');
    const receivedBuffer = Buffer.from(signature, 'hex');

    if (expectedBuffer.length !== receivedBuffer.length) {
      return { isValid: false, reason: 'signature_length_mismatch' };
    }

    const isValid = crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
    if (!isValid) {
      return { isValid: false, reason: 'signature_mismatch' };
    }

    return { isValid: true };
  } catch (err: any) {
    return { isValid: false, reason: `verification_exception: ${err?.message || 'unknown'}` };
  }
}
