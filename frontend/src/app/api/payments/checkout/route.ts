import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServiceClient, hasServiceRoleKey } from '@/lib/supabase/service';
import { getCommercialPlan, COMMERCIAL_PLANS } from '@/lib/billing/plans';

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate the caller
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      action,
      planId = 'yearly',
      workspaceId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = body;

    // Use privileged service client for database updates to ensure reliable transaction logging
    const dbClient = hasServiceRoleKey() ? createServiceClient() : supabase;

    // Razorpay credentials
    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    // ============================================
    // ACTION: CREATE ORDER
    // ============================================
    if (action === 'create') {
      const plan = getCommercialPlan(planId);
      if (!plan || plan.amountPaise <= 0) {
        return NextResponse.json(
          { error: 'Invalid or unsupported commercial plan selected' },
          { status: 400 }
        );
      }

      if (!keyId || !keySecret) {
        return NextResponse.json(
          { error: 'Payment gateway configuration is missing on the server' },
          { status: 503 }
        );
      }

      // Authoritative pricing: client-supplied amount is intentionally ignored
      const authoritativeAmount = plan.amountPaise;
      const receiptId = `tp_${user.id.slice(0, 8)}_${Date.now()}`.slice(0, 40);

      const authHeader = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
      const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: authoritativeAmount,
          currency: plan.currency,
          receipt: receiptId,
          notes: {
            userId: user.id,
            userEmail: user.email || '',
            planId: plan.id,
            workspaceId: workspaceId || '',
          },
        }),
      });

      if (!razorpayResponse.ok) {
        const errorData = await razorpayResponse.json().catch(() => ({}));
        console.error('[Razorpay Order Creation Failed]', errorData);
        return NextResponse.json(
          { error: errorData?.error?.description || 'Failed to initiate checkout with payment gateway' },
          { status: 502 }
        );
      }

      const order = await razorpayResponse.json();

      // Persist the created order in payments table
      const { error: insertError } = await dbClient.from('payments').insert({
        user_id: user.id,
        workspace_id: workspaceId || null,
        razorpay_order_id: order.id,
        amount_paise: authoritativeAmount,
        currency: plan.currency,
        status: 'created',
        plan_id: plan.id,
        receipt: receiptId,
        notes: {
          orderId: order.id,
          userId: user.id,
          planId: plan.id,
        },
      });

      if (insertError) {
        console.error('[Payments Journaling Error]', insertError);
        // We still proceed so the client can complete checkout
      }

      return NextResponse.json({
        order: {
          id: order.id,
          amount: order.amount,
          currency: order.currency,
          key: keyId,
          planName: plan.name,
        },
      });
    }

    // ============================================
    // ACTION: VERIFY PAYMENT SIGNATURE & ACTIVATE ENTITLEMENT
    // ============================================
    if (action === 'verify') {
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return NextResponse.json(
          { error: 'Missing payment verification credentials (order ID, payment ID, or signature)' },
          { status: 400 }
        );
      }

      if (!keySecret) {
        return NextResponse.json(
          { error: 'Payment gateway secret is missing on the server' },
          { status: 503 }
        );
      }

      // Verify HMAC-SHA256 signature
      const expectedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      const expectedBuffer = Buffer.from(expectedSignature, 'utf-8');
      const receivedBuffer = Buffer.from(razorpay_signature, 'utf-8');

      const isSignatureValid =
        expectedBuffer.length === receivedBuffer.length &&
        crypto.timingSafeEqual(expectedBuffer, receivedBuffer);

      if (!isSignatureValid) {
        console.error('[Razorpay Signature Mismatch]', {
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
        });
        return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
      }

      // Locate existing payment record to verify order ownership
      const { data: existingPayment } = await dbClient
        .from('payments')
        .select('*')
        .eq('razorpay_order_id', razorpay_order_id)
        .maybeSingle();

      if (existingPayment && existingPayment.user_id !== user.id) {
        return NextResponse.json(
          { error: 'Payment order does not belong to the authenticated user' },
          { status: 403 }
        );
      }

      // Idempotency: if already captured, return success immediately
      if (existingPayment && existingPayment.status === 'captured') {
        return NextResponse.json({
          success: true,
          message: 'Payment already verified and entitlement active',
          entitlement: {
            planId: existingPayment.plan_id,
          },
        });
      }

      const planKey = existingPayment?.plan_id || planId || 'yearly';
      const plan = getCommercialPlan(planKey) || COMMERCIAL_PLANS.yearly;
      const durationDays = plan.durationDays || 365;
      const validUntil = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

      // Update payment record to captured
      let paymentId = existingPayment?.id;
      if (existingPayment) {
        await dbClient
          .from('payments')
          .update({
            razorpay_payment_id,
            razorpay_signature,
            status: 'captured',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingPayment.id);
      } else {
        const { data: newPayment } = await dbClient
          .from('payments')
          .insert({
            user_id: user.id,
            workspace_id: workspaceId || null,
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            amount_paise: plan.amountPaise,
            currency: plan.currency,
            status: 'captured',
            plan_id: plan.id,
          })
          .select('id')
          .single();
        paymentId = newPayment?.id;
      }

      // Activate user entitlement in public.user_entitlements
      const { error: entitlementError } = await dbClient.from('user_entitlements').insert({
        user_id: user.id,
        plan_id: plan.id,
        status: 'active',
        max_workspaces: plan.maxWorkspaces,
        valid_from: new Date().toISOString(),
        valid_until: validUntil.toISOString(),
        payment_id: paymentId || null,
      });

      if (entitlementError) {
        console.error('[User Entitlement Activation Error]', entitlementError);
      }

      // If workspaceId was provided, update workspace subscription as well
      const targetWorkspaceId = workspaceId || existingPayment?.workspace_id;
      if (targetWorkspaceId) {
        await dbClient.from('workspace_subscriptions').upsert(
          {
            workspace_id: targetWorkspaceId,
            plan_id: plan.id,
            status: 'active',
            current_period_start: new Date().toISOString(),
            current_period_end: validUntil.toISOString(),
            payment_provider: 'razorpay',
            external_subscription_id: razorpay_payment_id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'workspace_id' }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Payment verified successfully and commercial plan activated',
        entitlement: {
          planId: plan.id,
          planName: plan.name,
          validUntil: validUntil.toISOString(),
          maxWorkspaces: plan.maxWorkspaces,
        },
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Supported actions: create, verify' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Checkout Route Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error during checkout' },
      { status: 500 }
    );
  }
}
