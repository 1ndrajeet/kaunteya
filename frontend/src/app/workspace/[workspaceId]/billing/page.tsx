'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  CreditCard,
  ShieldCheck,
  Zap,
  Building,
  Layers,
  Users,
  Check,
  Gift,
  AlertTriangle,
  Loader2,
  Clock,
  ArrowRight,
  RefreshCw,
} from '@/components/ui/pica-icons';
import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/features/workspace/workspace-context';
import { PricingUpgradeDialog } from '@/features/billing/pricing-upgrade-dialog';
import { formatINR } from '@/lib/billing/plans';
import type { Plan, WorkspaceSubscription } from '@/types/database';

interface PaymentRecord {
  id: string;
  planId: string;
  planName: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  orderId: string | null;
  paymentId: string | null;
}

interface EntitlementRecord {
  planId: string;
  maxWorkspaces: number;
  validUntil: string;
  status: string;
}

export default function WorkspaceBillingPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const unwrappedParams = use(params);
  const workspaceId = unwrappedParams.workspaceId;
  const { role, user, workspaceName } = useWorkspace();

  const [loading, setLoading] = useState<boolean>(true);
  const [subscription, setSubscription] = useState<WorkspaceSubscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [projectCount, setProjectCount] = useState<number>(0);
  const [teamCount, setTeamCount] = useState<number>(0);
  const [memberCount, setMemberCount] = useState<number>(0);

  // Payments Ledger & Entitlement State
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [entitlement, setEntitlement] = useState<EntitlementRecord | null>(null);
  const [loadingPayments, setLoadingPayments] = useState<boolean>(false);

  // Upgrade Modal
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState<boolean>(false);

  // Promo Code Form
  const [promoCode, setPromoCode] = useState<string>('');
  const [redeemingPromo, setRedeemingPromo] = useState<boolean>(false);
  const [promoStatus, setPromoStatus] = useState<{
    success?: boolean;
    message: string;
  } | null>(null);

  const fetchBillingData = async () => {
    setLoading(true);
    const supabase = createClient();

    try {
      // 1. Fetch plans
      const { data: plansData } = await supabase
        .from('plans')
        .select('*')
        .order('price_cents', { ascending: true });

      if (plansData) setPlans(plansData as Plan[]);

      // 2. Fetch workspace subscription
      const { data: subData } = await supabase
        .from('workspace_subscriptions')
        .select('*')
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      if (subData) {
        setSubscription(subData as WorkspaceSubscription);
      } else {
        // Fallback default free
        setSubscription({
          id: 'default',
          workspace_id: workspaceId,
          plan_id: 'free',
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: null,
          cancel_at_period_end: false,
          payment_provider: 'manual',
          external_customer_id: null,
          external_subscription_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      // 3. Resource usage: Projects
      const { count: pCount } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .neq('status', 'archived');

      setProjectCount(pCount || 0);

      // 4. Resource usage: Teams
      const { count: tCount } = await supabase
        .from('teams')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId);

      setTeamCount(tCount || 0);

      // 5. Resource usage: Members
      const { count: mCount } = await supabase
        .from('workspace_members')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId);

      setMemberCount(mCount || 0);

      // 6. Fetch payments history & user entitlement
      fetchPaymentHistory();
    } catch (err) {
      console.error('Failed to load billing metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentHistory = async () => {
    setLoadingPayments(true);
    try {
      const res = await fetch('/api/payments/history');
      if (res.ok) {
        const data = await res.json();
        setPayments(data.payments || []);
        setEntitlement(data.entitlement || null);
      }
    } catch (err) {
      console.error('Failed to load transaction history:', err);
    } finally {
      setLoadingPayments(false);
    }
  };

  useEffect(() => {
    fetchBillingData();
  }, [workspaceId]);

  const handleRedeemPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = promoCode.trim().toUpperCase();
    if (!cleanCode || !user) return;

    setRedeemingPromo(true);
    setPromoStatus(null);
    const supabase = createClient();

    try {
      const { data: promo, error: promoError } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('code', cleanCode)
        .eq('is_active', true)
        .maybeSingle();

      if (promoError || !promo) {
        setPromoStatus({
          success: false,
          message: 'Invalid or inactive promotional code. Example: LAUNCH50',
        });
        setRedeemingPromo(false);
        return;
      }

      const { error: redeemError } = await supabase.from('promo_redemptions').insert({
        promo_code_id: promo.id,
        workspace_id: workspaceId,
        user_id: user.id,
      });

      if (redeemError) {
        if (redeemError.code === '23505') {
          setPromoStatus({
            success: false,
            message: 'You have already redeemed this promotional code for your account.',
          });
        } else {
          setPromoStatus({
            success: false,
            message: `Redemption failed: ${redeemError.message}`,
          });
        }
      } else {
        setPromoStatus({
          success: true,
          message: `Code ${cleanCode} successfully redeemed! Entitlement recorded for ${workspaceName}.`,
        });
        setPromoCode('');
        fetchBillingData();
      }
    } catch (err) {
      setPromoStatus({
        success: false,
        message: err instanceof Error ? err.message : 'Redemption failed',
      });
    } finally {
      setRedeemingPromo(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-zinc-500 font-mono text-xs gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
        <span>Loading subscription &amp; billing metrics...</span>
      </div>
    );
  }

  const currentPlan = plans.find((p) => p.id === subscription?.plan_id) || plans[0] || {
    id: 'free',
    name: 'Starter Free',
    max_workspaces: 1,
    max_projects_per_workspace: 5,
    price_cents: 0,
    currency: 'INR',
    billing_interval: 'free',
  };

  const maxProjects = currentPlan.max_projects_per_workspace || 5;
  const projectUsagePercent = Math.min(100, Math.round((projectCount / maxProjects) * 100));

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 space-y-8 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-indigo-400" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">
              Billing &amp; Workspace Plans
            </h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Manage commercial subscription entitlements, workspace creation allowance, and Razorpay transactions.
          </p>
        </div>

        <button
          onClick={() => setIsUpgradeModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-all self-start sm:self-auto cursor-pointer"
        >
          <CreditCard className="h-4 w-4" /> Compare All Plans
        </button>
      </div>

      {/* User Entitlement Status Card */}
      {entitlement && (
        <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-950/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-indigo-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-indigo-200">
                Active Commercial Entitlement (Pro Yearly)
              </p>
              <p className="text-[11px] text-indigo-300/80">
                Authorized to provision up to {entitlement.maxWorkspaces} workspaces. Valid until{' '}
                {new Date(entitlement.validUntil).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
            Active
          </span>
        </div>
      )}

      {/* Current Plan Overview Card */}
      <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm space-y-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
          <div className="space-y-1">
            <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
              Current Workspace Tier
            </span>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-zinc-100">{currentPlan.name}</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                {subscription?.status || 'Active'}
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              {currentPlan.price_cents === 0
                ? 'Free forever for individual builders and hackathon teams (1 Free Workspace).'
                : `${formatINR(currentPlan.price_cents)} / ${currentPlan.billing_interval}`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsUpgradeModalOpen(true)}
              className="px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
            >
              Change / Upgrade Plan
            </button>
          </div>
        </div>

        {/* Resource Usage Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Projects Usage */}
          <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/60 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400 font-medium flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-indigo-400" /> Active Projects
              </span>
              <span className="font-mono text-zinc-200 font-semibold">
                {projectCount} / {maxProjects}
              </span>
            </div>
            <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  projectUsagePercent >= 100
                    ? 'bg-rose-500'
                    : projectUsagePercent >= 80
                      ? 'bg-amber-500'
                      : 'bg-indigo-500'
                }`}
                style={{ width: `${projectUsagePercent}%` }}
              />
            </div>
            <p className="text-[10px] text-zinc-500">
              {projectCount >= maxProjects
                ? 'Limit reached. Upgrade plan to create new projects.'
                : `${maxProjects - projectCount} project creation slots remaining.`}
            </p>
          </div>

          {/* Project Teams */}
          <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/60 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400 font-medium flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-violet-400" /> Project Teams
              </span>
              <span className="font-mono text-zinc-200 font-semibold">{teamCount} Teams</span>
            </div>
            <p className="text-xs text-zinc-300 pt-1">
              Project-scoped teams with dedicated leads
            </p>
            <p className="text-[10px] text-zinc-500">Unlimited on all plans</p>
          </div>

          {/* Workspace Members */}
          <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/60 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400 font-medium flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5 text-emerald-400" /> Workspace Members
              </span>
              <span className="font-mono text-zinc-200 font-semibold">{memberCount} Members</span>
            </div>
            <p className="text-xs text-zinc-300 pt-1">
              Multi-user collaborative access
            </p>
            <p className="text-[10px] text-zinc-500">Inviting members is always free</p>
          </div>
        </div>
      </div>

      {/* Transaction Ledger Card */}
      <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-indigo-400" />
            <h2 className="text-sm font-bold text-zinc-100">Transaction Ledger</h2>
          </div>
          <button
            onClick={fetchPaymentHistory}
            disabled={loadingPayments}
            className="text-[11px] font-mono text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition-colors"
          >
            <RefreshCw className={`h-3 w-3 ${loadingPayments ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loadingPayments ? (
          <div className="py-8 flex items-center justify-center text-xs text-zinc-500 font-mono gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
            Loading transaction records...
          </div>
        ) : payments.length === 0 ? (
          <div className="py-8 text-center space-y-1">
            <p className="text-xs text-zinc-400 font-medium">No payment transactions on record</p>
            <p className="text-[11px] text-zinc-500">
              Verified Razorpay payments for commercial plan upgrades will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800/80 text-[11px] font-mono text-zinc-400">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Plan</th>
                  <th className="pb-2 font-medium">Amount</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Order / Payment ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {payments.map((p) => (
                  <tr key={p.id} className="text-zinc-300">
                    <td className="py-2.5 font-mono text-[11px] text-zinc-400">
                      {new Date(p.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-2.5 font-medium text-zinc-100">{p.planName}</td>
                    <td className="py-2.5 font-mono font-semibold text-zinc-100">
                      {formatINR(p.amount)}
                    </td>
                    <td className="py-2.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold ${
                          p.status === 'captured'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : p.status === 'failed'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {p.status === 'captured' ? <Check className="h-2.5 w-2.5" /> : null}
                        {p.status}
                      </span>
                    </td>
                    <td className="py-2.5 font-mono text-[10px] text-zinc-500">
                      {p.paymentId || p.orderId || p.id.slice(0, 8)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Promotional Code Redemption Box */}
      <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 space-y-4">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-violet-400" />
          <h2 className="text-sm font-bold text-zinc-100">Redeem Promotional Voucher or Grant</h2>
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed max-w-2xl">
          If you have received an early adopter coupon (e.g. <span className="font-mono text-zinc-300">LAUNCH50</span>)
          or a founder grant code, enter it below to register your entitlement.
        </p>

        <form onSubmit={handleRedeemPromo} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 max-w-lg">
          <input
            type="text"
            placeholder="PROMO CODE"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            className="px-3.5 py-2 rounded-lg border border-zinc-700 bg-zinc-950 font-mono text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 uppercase flex-1"
          />
          <button
            type="submit"
            disabled={redeemingPromo || !promoCode.trim()}
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors disabled:opacity-50 shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {redeemingPromo ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Redeem Code'}
          </button>
        </form>

        {promoStatus && (
          <div
            className={`p-3 rounded-lg border text-xs font-mono flex items-center gap-2 ${
              promoStatus.success
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
            }`}
          >
            {promoStatus.success ? (
              <Check className="h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            )}
            <span>{promoStatus.message}</span>
          </div>
        )}
      </div>

      {/* Production Billing Architecture Disclosure */}
      <div className="p-4 rounded-xl border border-indigo-900/40 bg-indigo-950/20 text-indigo-200 text-xs flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-indigo-300">Production-Grade Billing Foundation</p>
          <p className="text-[11px] text-indigo-300/80 leading-relaxed">
            TaskPilot enforces workspace limits in PostgreSQL with transactional row locks. Every user receives 1 free
            workspace for life; additional workspaces require the Pro Yearly commercial plan at ₹3,000/year. Payment verification
            is completed server-side using Razorpay HMAC-SHA256 signatures before activating database entitlements.
          </p>
        </div>
      </div>

      {/* Upgrade Dialog */}
      <PricingUpgradeDialog
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        limitType="general"
        workspaceId={workspaceId}
        onSuccess={fetchBillingData}
      />
    </div>
  );
}
