import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { verifyGithubSignature } from '../verify-signature';

describe('GitHub Webhook Signature Verification', () => {
  const secret = 'super-secret-webhook-key-12345';
  const payload = JSON.stringify({ action: 'opened', number: 42, repository: { full_name: 'acme/core' } });

  function generateSignature(body: string, sec: string): string {
    const hex = crypto.createHmac('sha256', sec).update(body, 'utf8').digest('hex');
    return `sha256=${hex}`;
  }

  it('validates a correct HMAC-SHA256 signature', () => {
    const validHeader = generateSignature(payload, secret);
    const result = verifyGithubSignature({
      rawBody: payload,
      signatureHeader: validHeader,
      secret,
    });
    expect(result.isValid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('rejects a signature if raw body is tampered', () => {
    const validHeader = generateSignature(payload, secret);
    const tamperedPayload = JSON.stringify({ action: 'closed', number: 42 });
    const result = verifyGithubSignature({
      rawBody: tamperedPayload,
      signatureHeader: validHeader,
      secret,
    });
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('signature_mismatch');
  });

  it('rejects a signature created with a different secret', () => {
    const invalidHeader = generateSignature(payload, 'wrong-secret');
    const result = verifyGithubSignature({
      rawBody: payload,
      signatureHeader: invalidHeader,
      secret,
    });
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('signature_mismatch');
  });

  it('rejects when signature header is missing or null', () => {
    const result = verifyGithubSignature({
      rawBody: payload,
      signatureHeader: null,
      secret,
    });
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('missing_signature_header');
  });

  it('rejects when signature header lacks sha256= prefix', () => {
    const rawHex = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
    const result = verifyGithubSignature({
      rawBody: payload,
      signatureHeader: rawHex,
      secret,
    });
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('invalid_signature_prefix');
  });

  it('rejects when secret is empty', () => {
    const validHeader = generateSignature(payload, secret);
    const result = verifyGithubSignature({
      rawBody: payload,
      signatureHeader: validHeader,
      secret: '',
    });
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('missing_webhook_secret');
  });
});
