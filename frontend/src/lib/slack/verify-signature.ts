import crypto from 'crypto';

export interface VerifySlackSignatureParams {
  signature: string | null;
  timestamp: string | null;
  rawBody: string;
  signingSecret: string;
}

export interface VerificationResult {
  isValid: boolean;
  reason?: string;
}

/**
 * Verifies that a request from Slack is authentic by checking the HMAC SHA256 signature
 * against the configured Slack Signing Secret.
 *
 * Prevents replay attacks by rejecting requests older than 5 minutes.
 */
export function verifySlackSignature({
  signature,
  timestamp,
  rawBody,
  signingSecret,
}: VerifySlackSignatureParams): VerificationResult {
  if (!signature) {
    return { isValid: false, reason: 'Missing x-slack-signature header' };
  }

  if (!timestamp) {
    return { isValid: false, reason: 'Missing x-slack-request-timestamp header' };
  }

  if (!signingSecret) {
    return { isValid: false, reason: 'Slack signing secret is not configured' };
  }

  // Verify timestamp freshness (within 5 minutes = 300 seconds)
  const currentTime = Math.floor(Date.now() / 1000);
  const requestTime = parseInt(timestamp, 10);

  if (isNaN(requestTime)) {
    return { isValid: false, reason: 'Invalid timestamp format' };
  }

  if (Math.abs(currentTime - requestTime) > 300) {
    return {
      isValid: false,
      reason: `Stale request: timestamp differs by ${Math.abs(currentTime - requestTime)}s (> 300s limit)`,
    };
  }

  // Construct the signature base string: "v0:<timestamp>:<raw_body>"
  const sigBasestring = `v0:${timestamp}:${rawBody}`;

  // Calculate HMAC SHA256
  const hmac = crypto.createHmac('sha256', signingSecret);
  hmac.update(sigBasestring, 'utf8');
  const calculatedSignature = `v0=${hmac.digest('hex')}`;

  // Use timing-safe comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signature, 'utf8');
  const calcBuffer = Buffer.from(calculatedSignature, 'utf8');

  if (sigBuffer.length !== calcBuffer.length) {
    return { isValid: false, reason: 'Signature length mismatch' };
  }

  const isMatch = crypto.timingSafeEqual(sigBuffer, calcBuffer);

  if (!isMatch) {
    return { isValid: false, reason: 'HMAC signature verification failed' };
  }

  return { isValid: true };
}
