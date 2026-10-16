import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { verifySlackSignature } from '../verify-signature';

describe('verifySlackSignature', () => {
  const secret = 'test-signing-secret-894729384';
  const rawBody = JSON.stringify({ type: 'url_verification', challenge: 'xyz123' });

  function generateValidSignature(body: string, timestamp: number, secretKey: string) {
    const basestring = `v0:${timestamp}:${body}`;
    const hmac = crypto.createHmac('sha256', secretKey);
    hmac.update(basestring, 'utf8');
    return `v0=${hmac.digest('hex')}`;
  }

  it('accepts a freshly signed valid Slack request', () => {
    const now = Math.floor(Date.now() / 1000);
    const signature = generateValidSignature(rawBody, now, secret);

    const result = verifySlackSignature({
      signature,
      timestamp: now.toString(),
      rawBody,
      signingSecret: secret,
    });

    expect(result.isValid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('rejects requests with missing signature', () => {
    const now = Math.floor(Date.now() / 1000);
    const result = verifySlackSignature({
      signature: null,
      timestamp: now.toString(),
      rawBody,
      signingSecret: secret,
    });

    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('Missing x-slack-signature');
  });

  it('rejects requests with missing timestamp', () => {
    const result = verifySlackSignature({
      signature: 'v0=somehash',
      timestamp: null,
      rawBody,
      signingSecret: secret,
    });

    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('Missing x-slack-request-timestamp');
  });

  it('rejects stale requests older than 300 seconds (replay attack protection)', () => {
    const staleTime = Math.floor(Date.now() / 1000) - 350; // 350s ago (> 300s limit)
    const signature = generateValidSignature(rawBody, staleTime, secret);

    const result = verifySlackSignature({
      signature,
      timestamp: staleTime.toString(),
      rawBody,
      signingSecret: secret,
    });

    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('Stale request');
  });

  it('rejects requests with tampered raw body', () => {
    const now = Math.floor(Date.now() / 1000);
    const signature = generateValidSignature(rawBody, now, secret);
    const tamperedBody = rawBody + ' ';

    const result = verifySlackSignature({
      signature,
      timestamp: now.toString(),
      rawBody: tamperedBody,
      signingSecret: secret,
    });

    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('HMAC signature verification failed');
  });

  it('rejects requests with wrong signing secret', () => {
    const now = Math.floor(Date.now() / 1000);
    const signature = generateValidSignature(rawBody, now, 'wrong-secret');

    const result = verifySlackSignature({
      signature,
      timestamp: now.toString(),
      rawBody,
      signingSecret: secret,
    });

    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('HMAC signature verification failed');
  });
});
