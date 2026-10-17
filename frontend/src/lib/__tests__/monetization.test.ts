import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { NextRequest } from 'next/server';
import {
  evaluateWorkspaceCreationLimit,
} from '../limits';
import {
  COMMERCIAL_PLANS,
  getCommercialPlan,
  formatINR,
} from '../billing/plans';
import { POST as checkoutPost } from '@/app/api/payments/checkout/route';
import { GET as historyGet } from '@/app/api/payments/history/route';
import { POST as webhookPost } from '@/app/api/payments/webhook/route';

// Mock Supabase Server and Service
const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  })),
}));

vi.mock('@/lib/supabase/service', () => ({
  hasServiceRoleKey: vi.fn(() => true),
  createServiceClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

describe('TaskPilot Workspace Monetization & Razorpay Integration', () => {
  const TEST_KEY_ID = 'rzp_test_123456';
  const TEST_KEY_SECRET = 'test_secret_abcdef123456';
  const TEST_WEBHOOK_SECRET = 'test_webhook_secret_7890';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = TEST_KEY_ID;
    process.env.RAZORPAY_KEY_SECRET = TEST_KEY_SECRET;
    process.env.RAZORPAY_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
  });

  /* ========================================================================
   * 1. WORKSPACE CREATION LIMITS & ENTITLEMENT SEMANTICS
   * ======================================================================== */
  describe('Workspace Creation Limits & Entitlement Evaluation', () => {
    it('allows the first workspace for free when user has 0 lifetime created workspaces', () => {
      const evaluation = evaluateWorkspaceCreationLimit(0, null);
      expect(evaluation.isEligibleToCreate).toBe(true);
      expect(evaluation.maxWorkspaces).toBe(1);
      expect(evaluation.hasActiveEntitlement).toBe(false);
    });

    it('rejects a second workspace on the free tier when user already created 1 workspace', () => {
      const evaluation = evaluateWorkspaceCreationLimit(1, null);
      expect(evaluation.isEligibleToCreate).toBe(false);
      expect(evaluation.maxWorkspaces).toBe(1);
      expect(evaluation.hasActiveEntitlement).toBe(false);
    });

    it('permits second and subsequent workspaces up to 10 when user has an active Pro entitlement', () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const entitlement = {
        status: 'active',
        validUntil: futureDate,
        maxWorkspaces: 10,
      };

      // 2nd workspace (created count = 1)
      const evaluation2 = evaluateWorkspaceCreationLimit(1, entitlement);
      expect(evaluation2.isEligibleToCreate).toBe(true);
      expect(evaluation2.hasActiveEntitlement).toBe(true);
      expect(evaluation2.maxWorkspaces).toBe(10);

      // 10th workspace (created count = 9)
      const evaluation10 = evaluateWorkspaceCreationLimit(9, entitlement);
      expect(evaluation10.isEligibleToCreate).toBe(true);

      // 11th workspace (created count = 10, reaching max 10)
      const evaluation11 = evaluateWorkspaceCreationLimit(10, entitlement);
      expect(evaluation11.isEligibleToCreate).toBe(false);
    });

    it('rejects workspace creation if the paid entitlement has expired', () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const expiredEntitlement = {
        status: 'active',
        validUntil: pastDate,
        maxWorkspaces: 10,
      };

      const evaluation = evaluateWorkspaceCreationLimit(1, expiredEntitlement);
      expect(evaluation.isEligibleToCreate).toBe(false);
      expect(evaluation.hasActiveEntitlement).toBe(false);
      expect(evaluation.maxWorkspaces).toBe(1);
    });

    it('rejects workspace creation if entitlement status is cancelled or inactive', () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const cancelledEntitlement = {
        status: 'cancelled',
        validUntil: futureDate,
        maxWorkspaces: 10,
      };

      const evaluation = evaluateWorkspaceCreationLimit(1, cancelledEntitlement);
      expect(evaluation.isEligibleToCreate).toBe(false);
      expect(evaluation.hasActiveEntitlement).toBe(false);
    });

    it('ensures lifetime created count is not reduced by deleting workspaces', () => {
      // Simulating a user who created 1 workspace, deleted it, but lifetime count remains 1
      const lifetimeCountAfterDeletion = 1;
      const evaluation = evaluateWorkspaceCreationLimit(lifetimeCountAfterDeletion, null);
      // Still ineligible for a free 2nd creation
      expect(evaluation.isEligibleToCreate).toBe(false);
    });
  });

  /* ========================================================================
   * 2. AUTHORITATIVE COMMERCIAL PRICING & CURRENCY
   * ======================================================================== */
  describe('Authoritative Commercial Pricing & Formatting', () => {
    it('defines Pro Yearly at exactly ₹3,000 INR (300,000 paise)', () => {
      const plan = getCommercialPlan('yearly');
      expect(plan).toBeDefined();
      expect(plan?.amountPaise).toBe(300000);
      expect(plan?.currency).toBe('INR');
      expect(plan?.billingInterval).toBe('yearly');
      expect(plan?.maxWorkspaces).toBe(10);
      expect(plan?.durationDays).toBe(365);
    });

    it('formats INR currency correctly from paise', () => {
      expect(formatINR(300000)).toBe('₹3,000');
      expect(formatINR(0)).toBe('₹0');
      expect(formatINR(999900)).toBe('₹9,999');
    });

    it('returns undefined for invalid or unknown plan IDs', () => {
      expect(getCommercialPlan('unlimited_plan_free')).toBeUndefined();
      expect(getCommercialPlan('custom_exploit')).toBeUndefined();
    });
  });

  /* ========================================================================
   * 3. RAZORPAY CHECKOUT ROUTE (POST /api/payments/checkout)
   * ======================================================================== */
  describe('POST /api/payments/checkout', () => {
    it('rejects unauthenticated requests with 401', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('No session') });

      const req = new NextRequest('http://localhost:3000/api/payments/checkout', {
        method: 'POST',
        body: JSON.stringify({ action: 'create', planId: 'yearly' }),
      });

      const res = await checkoutPost(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('rejects unknown or invalid plans with 400', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: 'usr_123', email: 'test@example.com' } },
        error: null,
      });

      const req = new NextRequest('http://localhost:3000/api/payments/checkout', {
        method: 'POST',
        body: JSON.stringify({ action: 'create', planId: 'unknown_scam_plan' }),
      });

      const res = await checkoutPost(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Invalid or unsupported');
    });

    it('ignores client-supplied amount manipulation and creates order with authoritative ₹3,000 (300000 paise)', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: 'usr_123', email: 'test@example.com' } },
        error: null,
      });

      // Mock Razorpay Orders API fetch call
      const mockFetch = vi.spyOn(global, 'fetch').mockImplementationOnce(async (url: any, init: any) => {
        expect(url).toBe('https://api.razorpay.com/v1/orders');
        const sentBody = JSON.parse(init.body);
        // CRITICAL CHECK: client sent amount: 10, but server must send 300000
        expect(sentBody.amount).toBe(300000);
        expect(sentBody.currency).toBe('INR');

        return new Response(
          JSON.stringify({
            id: 'order_test_9999',
            amount: 300000,
            currency: 'INR',
          }),
          { status: 200 }
        );
      });

      // Mock database insert
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      mockFrom.mockReturnValue({ insert: mockInsert });

      // Client attempts to spoof price with amount: 10 paise instead of 300000
      const req = new NextRequest('http://localhost:3000/api/payments/checkout', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create',
          planId: 'yearly',
          amount: 10, // Spoofed amount! Must be ignored.
        }),
      });

      const res = await checkoutPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.order.id).toBe('order_test_9999');
      expect(data.order.amount).toBe(300000);

      mockFetch.mockRestore();
    });

    it('rejects invalid payment signatures with 400', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: 'usr_123', email: 'test@example.com' } },
        error: null,
      });

      const req = new NextRequest('http://localhost:3000/api/payments/checkout', {
        method: 'POST',
        body: JSON.stringify({
          action: 'verify',
          planId: 'yearly',
          razorpay_order_id: 'order_123',
          razorpay_payment_id: 'pay_123',
          razorpay_signature: 'forged_invalid_signature_hex',
        }),
      });

      const res = await checkoutPost(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid payment signature');
    });

    it('rejects order claim if payment order belongs to a different user with 403', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: 'usr_attacker', email: 'attacker@example.com' } },
        error: null,
      });

      const orderId = 'order_valid_123';
      const paymentId = 'pay_valid_456';
      const validSignature = crypto
        .createHmac('sha256', TEST_KEY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      // Database returns existing payment belonging to 'usr_victim'
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: 'pay_rec_1',
                user_id: 'usr_victim', // Different user!
                status: 'created',
              },
            }),
          }),
        }),
      });

      const req = new NextRequest('http://localhost:3000/api/payments/checkout', {
        method: 'POST',
        body: JSON.stringify({
          action: 'verify',
          planId: 'yearly',
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: validSignature,
        }),
      });

      const res = await checkoutPost(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('does not belong to the authenticated user');
    });

    it('verifies valid HMAC-SHA256 signature and activates entitlement idempotently', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: 'usr_buyer', email: 'buyer@example.com' } },
        error: null,
      });

      const orderId = 'order_verified_777';
      const paymentId = 'pay_verified_888';
      const validSignature = crypto
        .createHmac('sha256', TEST_KEY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'payments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: 'pay_rec_99',
                    user_id: 'usr_buyer',
                    status: 'created',
                    plan_id: 'yearly',
                  },
                }),
              }),
            }),
            update: mockUpdate,
          };
        }
        if (table === 'user_entitlements') {
          return {
            insert: mockInsert,
          };
        }
        return {
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
      });

      const req = new NextRequest('http://localhost:3000/api/payments/checkout', {
        method: 'POST',
        body: JSON.stringify({
          action: 'verify',
          planId: 'yearly',
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: validSignature,
        }),
      });

      const res = await checkoutPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.entitlement.planId).toBe('yearly');
      expect(data.entitlement.maxWorkspaces).toBe(10);
      expect(mockInsert).toHaveBeenCalled();
    });

    it('is idempotent when verifying an already captured payment', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: 'usr_buyer', email: 'buyer@example.com' } },
        error: null,
      });

      const orderId = 'order_captured_already';
      const paymentId = 'pay_captured_already';
      const validSignature = crypto
        .createHmac('sha256', TEST_KEY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: 'pay_rec_already',
                user_id: 'usr_buyer',
                status: 'captured', // Already captured!
                plan_id: 'yearly',
              },
            }),
          }),
        }),
      });

      const req = new NextRequest('http://localhost:3000/api/payments/checkout', {
        method: 'POST',
        body: JSON.stringify({
          action: 'verify',
          planId: 'yearly',
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: validSignature,
        }),
      });

      const res = await checkoutPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('already verified');
    });
  });

  /* ========================================================================
   * 4. RAZORPAY WEBHOOK ROUTE (POST /api/payments/webhook)
   * ======================================================================== */
  describe('POST /api/payments/webhook', () => {
    it('rejects webhooks with missing signature with 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/payments/webhook', {
        method: 'POST',
        body: JSON.stringify({ event: 'payment.captured' }),
      });

      const res = await webhookPost(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Missing x-razorpay-signature');
    });

    it('rejects webhooks with invalid HMAC-SHA256 signature with 401', async () => {
      const bodyStr = JSON.stringify({ event: 'payment.captured' });
      const req = new NextRequest('http://localhost:3000/api/payments/webhook', {
        method: 'POST',
        headers: {
          'x-razorpay-signature': 'invalid_forged_webhook_sig',
        },
        body: bodyStr,
      });

      const res = await webhookPost(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Invalid webhook signature');
    });

    it('successfully reconciles payment and activates entitlement on payment.captured event', async () => {
      const payload = {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_wh_123',
              order_id: 'order_wh_456',
              amount: 300000,
              currency: 'INR',
              notes: {
                userId: 'usr_webhook_buyer',
                planId: 'yearly',
              },
            },
          },
        },
      };

      const rawBody = JSON.stringify(payload);
      const validSignature = crypto
        .createHmac('sha256', TEST_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');

      const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'payments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: 'pay_internal_wh_1',
                    user_id: 'usr_webhook_buyer',
                    status: 'created',
                    plan_id: 'yearly',
                  },
                }),
              }),
            }),
            update: mockUpdate,
          };
        }
        if (table === 'user_entitlements') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null }), // Not yet activated
              }),
            }),
            insert: mockInsert,
          };
        }
        return {
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
      });

      const req = new NextRequest('http://localhost:3000/api/payments/webhook', {
        method: 'POST',
        headers: {
          'x-razorpay-signature': validSignature,
        },
        body: rawBody,
      });

      const res = await webhookPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('processed');
      expect(mockInsert).toHaveBeenCalled();
    });

    it('idempotently handles duplicate webhook deliveries', async () => {
      const payload = {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_wh_dup',
              order_id: 'order_wh_dup',
              amount: 300000,
              currency: 'INR',
              notes: {
                userId: 'usr_webhook_buyer',
                planId: 'yearly',
              },
            },
          },
        },
      };

      const rawBody = JSON.stringify(payload);
      const validSignature = crypto
        .createHmac('sha256', TEST_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');

      // Return already captured payment
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: 'pay_internal_wh_1',
                status: 'captured', // Already captured!
              },
            }),
          }),
        }),
      });

      const req = new NextRequest('http://localhost:3000/api/payments/webhook', {
        method: 'POST',
        headers: {
          'x-razorpay-signature': validSignature,
        },
        body: rawBody,
      });

      const res = await webhookPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('already_processed');
    });
  });

  /* ========================================================================
   * 5. PAYMENTS HISTORY ROUTE (GET /api/payments/history)
   * ======================================================================== */
  describe('GET /api/payments/history', () => {
    it('rejects unauthenticated requests with 401', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('No session') });

      const res = await historyGet();
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('returns only the authenticated user payments and active entitlement', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: 'usr_me', email: 'me@example.com' } },
        error: null,
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'payments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation((col: string, val: string) => {
                expect(col).toBe('user_id');
                expect(val).toBe('usr_me');
                return {
                  order: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: 'pay_hist_1',
                        user_id: 'usr_me',
                        plan_id: 'yearly',
                        amount_paise: 300000,
                        currency: 'INR',
                        status: 'captured',
                        created_at: '2026-10-17T06:00:00Z',
                        razorpay_order_id: 'order_1',
                        razorpay_payment_id: 'pay_1',
                      },
                    ],
                    error: null,
                  }),
                };
              }),
            }),
          };
        }
        if (table === 'user_entitlements') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  gt: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({
                          data: {
                            plan_id: 'yearly',
                            max_workspaces: 10,
                            valid_until: '2027-10-17T06:00:00Z',
                            status: 'active',
                          },
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const res = await historyGet();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.payments).toHaveLength(1);
      expect(data.payments[0].amount).toBe(300000);
      expect(data.payments[0].planName).toBe('Pro Yearly');
      expect(data.entitlement.maxWorkspaces).toBe(10);
    });
  });
});
