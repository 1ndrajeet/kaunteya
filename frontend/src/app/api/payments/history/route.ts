import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServiceClient, hasServiceRoleKey } from '@/lib/supabase/service';
import { getCommercialPlan } from '@/lib/billing/plans';

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbClient = hasServiceRoleKey() ? createServiceClient() : supabase;

    // Fetch user's payments
    const { data: userPayments, error: paymentsError } = await dbClient
      .from('payments')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (paymentsError) {
      console.error('[Payments History Error]', paymentsError);
      return NextResponse.json({ error: 'Failed to retrieve payments history' }, { status: 500 });
    }

    // Fetch user's active entitlement
    const { data: entitlement } = await dbClient
      .from('user_entitlements')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .gt('valid_until', new Date().toISOString())
      .order('valid_until', { ascending: false })
      .limit(1)
      .maybeSingle();

    const formattedPayments = (userPayments || []).map((p) => {
      const plan = getCommercialPlan(p.plan_id);
      return {
        id: p.id,
        planId: p.plan_id,
        planName: plan?.name || 'Pro Yearly',
        amount: p.amount_paise,
        currency: p.currency,
        status: p.status,
        createdAt: p.created_at,
        orderId: p.razorpay_order_id,
        paymentId: p.razorpay_payment_id,
      };
    });

    return NextResponse.json({
      payments: formattedPayments,
      entitlement: entitlement
        ? {
            planId: entitlement.plan_id,
            maxWorkspaces: entitlement.max_workspaces,
            validUntil: entitlement.valid_until,
            status: entitlement.status,
          }
        : null,
    });
  } catch (error) {
    console.error('[Payments History Exception]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
