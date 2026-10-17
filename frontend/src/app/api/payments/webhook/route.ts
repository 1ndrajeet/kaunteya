import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient, hasServiceRoleKey } from '@/lib/supabase/service';
import { getCommercialPlan, COMMERCIAL_PLANS } from '@/lib/billing/plans';

export async function POST(req: NextRequest) {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET is not configured on the server');
      return NextResponse.json(
        { error: 'Webhook secret is not configured' },
        { status: 500 }
      );
    }

    const signature = req.headers.get('x-razorpay-signature');
    if (!signature) {
      return NextResponse.json({ error: 'Missing x-razorpay-signature header' }, { status: 400 });
    }

    const rawBody = await req.text();
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf-8');
    const receivedBuffer = Buffer.from(signature, 'utf-8');

    const isSignatureValid =
      expectedBuffer.length === receivedBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, receivedBuffer);

    if (!isSignatureValid) {
      console.error('[Razorpay Webhook] Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event;
    console.log(`[Razorpay Webhook] Received verified event: ${event}`);

    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = payload.payload?.payment?.entity;
      const orderEntity = payload.payload?.order?.entity;

      const orderId = paymentEntity?.order_id || orderEntity?.id;
      const paymentId = paymentEntity?.id;
      const notes = paymentEntity?.notes || orderEntity?.notes || {};
      const userId = notes.userId;
      const planId = notes.planId || 'yearly';
      const workspaceId = notes.workspaceId;

      if (!orderId && !paymentId) {
        return NextResponse.json({ status: 'ignored_missing_identifiers' }, { status: 200 });
      }

      if (!hasServiceRoleKey()) {
        console.error('[Razorpay Webhook] SUPABASE_SERVICE_ROLE_KEY missing for background processing');
        return NextResponse.json({ error: 'Service client unavailable' }, { status: 500 });
      }

      const dbClient = createServiceClient();

      // Check existing payment
      let query = dbClient.from('payments').select('*');
      if (orderId) {
        query = query.eq('razorpay_order_id', orderId);
      } else {
        query = query.eq('razorpay_payment_id', paymentId);
      }
      const { data: existingPayment } = await query.maybeSingle();

      // If already captured, nothing to do (idempotent)
      if (existingPayment?.status === 'captured') {
        return NextResponse.json({ status: 'already_processed' }, { status: 200 });
      }

      const plan = getCommercialPlan(planId) || COMMERCIAL_PLANS.yearly;
      const durationDays = plan.durationDays || 365;
      const validUntil = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

      const targetUserId = userId || existingPayment?.user_id;
      if (!targetUserId) {
        console.error('[Razorpay Webhook] Could not resolve user_id for order:', orderId);
        return NextResponse.json({ status: 'unresolved_user' }, { status: 200 });
      }

      let internalPaymentId = existingPayment?.id;

      if (existingPayment) {
        await dbClient
          .from('payments')
          .update({
            razorpay_payment_id: paymentId || existingPayment.razorpay_payment_id,
            status: 'captured',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingPayment.id);
      } else {
        const { data: newPayment } = await dbClient
          .from('payments')
          .insert({
            user_id: targetUserId,
            workspace_id: workspaceId || null,
            razorpay_order_id: orderId,
            razorpay_payment_id: paymentId,
            amount_paise: paymentEntity?.amount || plan.amountPaise,
            currency: paymentEntity?.currency || plan.currency,
            status: 'captured',
            plan_id: plan.id,
            notes,
          })
          .select('id')
          .single();
        internalPaymentId = newPayment?.id;
      }

      // Check if user entitlement already activated
      let isAlreadyActivated = false;
      if (internalPaymentId) {
        const { data: existingEntitlement } = await dbClient
          .from('user_entitlements')
          .select('id')
          .eq('payment_id', internalPaymentId)
          .maybeSingle();
        if (existingEntitlement) {
          isAlreadyActivated = true;
        }
      }

      if (!isAlreadyActivated) {
        await dbClient.from('user_entitlements').insert({
          user_id: targetUserId,
          plan_id: plan.id,
          status: 'active',
          max_workspaces: plan.maxWorkspaces,
          valid_from: new Date().toISOString(),
          valid_until: validUntil.toISOString(),
          payment_id: internalPaymentId || null,
        });
      }

      // If workspace was associated, update subscription
      const targetWsId = workspaceId || existingPayment?.workspace_id;
      if (targetWsId) {
        await dbClient.from('workspace_subscriptions').upsert(
          {
            workspace_id: targetWsId,
            plan_id: plan.id,
            status: 'active',
            current_period_start: new Date().toISOString(),
            current_period_end: validUntil.toISOString(),
            payment_provider: 'razorpay',
            external_subscription_id: paymentId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'workspace_id' }
        );
      }
    }

    return NextResponse.json({ status: 'processed' }, { status: 200 });
  } catch (error) {
    console.error('[Razorpay Webhook Exception]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal webhook error' },
      { status: 500 }
    );
  }
}
