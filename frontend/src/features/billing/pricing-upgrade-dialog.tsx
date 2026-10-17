'use client';

import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  Zap,
  Check,
  AlertTriangle,
  Gift,
  ArrowRight,
  Loader2,
  Clock,
  Layers,
  Building,
  CreditCard,
} from '@/components/ui/pica-icons';
import { createClient } from '@/lib/supabase/client';
import { COMMERCIAL_PLANS, formatINR } from '@/lib/billing/plans';

export interface PricingUpgradeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  limitType?: 'workspace' | 'project' | 'general';
  currentCount?: number;
  maxAllowed?: number;
  customTitle?: string;
  customDescription?: string;
  workspaceId?: string;
  onSuccess?: () => void;
}

interface PlanItem {
  id: string;
  name: string;
  subtitle: string;
  price: string;
  period: string;
  badge?: string;
  popular?: boolean;
  features: string[];
}

const PLANS: PlanItem[] = [
  {
    id: 'free',
    name: 'Starter Free',
    subtitle: 'Essential coordination for individual builders & small squads',
    price: '₹0',
    period: 'forever',
    features: [
      '1 Workspace per user account (Free forever)',
      'Up to 5 Projects per workspace',
      'Project-scoped teams & team leads',
      'Join unlimited workspaces via invitations',
      'Slack intake & automated follow-ups',
      'GitHub repository evidence linking',
    ],
  },
  {
    id: 'yearly',
    name: 'Pro Yearly',
    subtitle: 'Commercial multi-workspace delivery coordination for engineering teams',
    price: '₹3,000',
    period: 'per year',
    badge: 'Recommended',
    popular: true,
    features: [
      'Up to 10 Workspaces (₹3,000/year annual entitlement)',
      'Up to 50 Projects per workspace',
      'Unlimited project teams & members',
      'Priority GitHub webhook ingestion',
      'Gemini AI autonomous task routing',
      'Automated claim-to-evidence matching',
      'Extended audit log retention',
    ],
  },
  {
    id: 'onetime',
    name: 'Founder Lifetime',
    subtitle: 'Single investment for permanent autonomous execution',
    price: '₹9,999',
    period: 'one-time payment',
    badge: 'Founding Backer',
    features: [
      'Unlimited Workspaces',
      'Unlimited Projects & Teams',
      'All present & future Pro capabilities',
      'Full Gemini AI evidence analysis access',
      'Early access to multi-agent sidecars',
      'Founding member badge & direct support',
    ],
  },
];

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if ((window as any).Razorpay) return resolve(true);

    const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true), { once: true });
      existingScript.addEventListener('error', () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function PricingUpgradeDialog({
  isOpen,
  onClose,
  limitType = 'general',
  currentCount,
  maxAllowed,
  customTitle,
  customDescription,
  workspaceId,
  onSuccess,
}: PricingUpgradeDialogProps) {
  const [selectedPlan, setSelectedPlan] = useState<string>('yearly');
  const [promoCodeInput, setPromoCodeInput] = useState<string>('');
  const [promoValidating, setPromoValidating] = useState<boolean>(false);
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discountPercent?: number | null;
    discountAmountCents?: number | null;
    description: string | null;
  } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  // Razorpay Checkout State
  const [checkoutLoading, setCheckoutLoading] = useState<boolean>(false);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleValidatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = promoCodeInput.trim().toUpperCase();
    if (!cleanCode) return;

    setPromoValidating(true);
    setPromoError(null);
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('code', cleanCode)
        .eq('is_active', true)
        .maybeSingle();

      if (error || !data) {
        setPromoError('Invalid or expired promotional code. Try LAUNCH50.');
        setAppliedPromo(null);
      } else {
        if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
          setPromoError('This promotional code has expired.');
          setAppliedPromo(null);
        } else if (data.uses_count >= data.max_uses) {
          setPromoError('This promotional code has reached its maximum redemptions.');
          setAppliedPromo(null);
        } else {
          setAppliedPromo({
            code: data.code,
            discountPercent: data.discount_percent,
            discountAmountCents: data.discount_amount_cents,
            description: data.description,
          });
          setPromoError(null);
        }
      }
    } catch {
      setPromoError('Failed to validate promotional code.');
    } finally {
      setPromoValidating(false);
    }
  };

  const handleCheckout = async () => {
    if (selectedPlan === 'free') {
      onClose();
      return;
    }

    setCheckoutLoading(true);
    setCheckoutError(null);
    setCheckoutSuccess(null);

    try {
      // 1. Ensure Razorpay SDK is loaded
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        throw new Error('Failed to load Razorpay payment SDK. Please verify your connection.');
      }

      // 2. Create Razorpay order via server API
      const response = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          planId: selectedPlan,
          workspaceId,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to initialize payment order');
      }

      const { order } = data;

      // 3. Launch Razorpay modal
      const options = {
        key: order.key || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: 'TaskPilot',
        description: `${order.planName || 'Pro'} Plan — Workspace Creation Entitlement`,
        order_id: order.id,
        theme: { color: '#4f46e5' },
        handler: async (rzpResponse: any) => {
          setVerifying(true);
          try {
            const verifyRes = await fetch('/api/payments/checkout', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'verify',
                planId: selectedPlan,
                workspaceId,
                razorpay_order_id: rzpResponse.razorpay_order_id,
                razorpay_payment_id: rzpResponse.razorpay_payment_id,
                razorpay_signature: rzpResponse.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) {
              throw new Error(verifyData.error || 'Payment verification failed');
            }

            setCheckoutSuccess('Payment verified successfully! Your Pro commercial entitlement is now active.');
            if (onSuccess) onSuccess();

            setTimeout(() => {
              window.location.reload();
            }, 1200);
          } catch (err) {
            setCheckoutError(err instanceof Error ? err.message : 'Verification failed');
          } finally {
            setVerifying(false);
            setCheckoutLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setCheckoutLoading(false);
            setCheckoutError('Checkout was dismissed. No charges were processed.');
          },
        },
      };

      const razorpayInstance = new (window as any).Razorpay(options);
      razorpayInstance.open();
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Checkout initiation failed');
      setCheckoutLoading(false);
    }
  };

  const isWorkspaceLimit = limitType === 'workspace';
  const isProjectLimit = limitType === 'project';

  const defaultTitle = isWorkspaceLimit
    ? 'Workspace Limit Reached (1/1 on Free Plan)'
    : isProjectLimit
      ? `Project Limit Reached (${maxAllowed || 5}/${maxAllowed || 5} on Current Plan)`
      : 'Upgrade TaskPilot Plan';

  const defaultDescription = isWorkspaceLimit
    ? 'Every user can create 1 workspace for free. Creating additional workspaces requires the Pro Yearly plan (₹3,000/year for up to 10 workspaces). Joining existing workspaces via invitations remains completely free.'
    : isProjectLimit
      ? `This workspace has reached its limit of ${maxAllowed || 5} active projects. Upgrade your workspace plan to create more projects, coordinate multiple initiatives, and scale teams.`
      : 'Choose a commercial plan to unlock higher resource capacities, autonomous task routing, and continuous GitHub evidence verification.';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#23170E]/40 backdrop-blur-xs overflow-y-auto antialiased">
      <div className="relative w-full max-w-4xl rounded-2xl border border-[#E3DAC8] bg-[#FAF7F2] shadow-2xl p-6 sm:p-8 space-y-6 my-8 text-[#23170E]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-lg text-[#736251] hover:text-[#23170E] hover:bg-[#F2ECE1] transition-colors"
          aria-label="Close dialog"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Limit Warning Banner */}
        {(isWorkspaceLimit || isProjectLimit) && (
          <div className="p-4 rounded-xl border border-[#F1DCBA] bg-[#FCF3E3] text-[#824B04] flex items-start gap-3">
            {isWorkspaceLimit ? (
              <Building className="h-5 w-5 text-[#824B04] shrink-0 mt-0.5" />
            ) : (
              <Layers className="h-5 w-5 text-[#824B04] shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <h3 className="font-semibold text-sm text-[#824B04]">
                {customTitle || defaultTitle}
              </h3>
              <p className="text-xs text-[#824B04]/90 leading-relaxed">
                {customDescription || defaultDescription}
              </p>
            </div>
          </div>
        )}

        {/* Header */}
        {!isWorkspaceLimit && !isProjectLimit && (
          <div className="space-y-2 text-center max-w-xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#F1DCBA] bg-[#FCF3E3] text-[#824B04] text-xs font-mono font-medium">
              <Building className="h-3.5 w-3.5" /> TaskPilot Commercial Plans
            </div>
            <h2 className="text-2xl font-serif font-bold tracking-tight text-[#23170E]">
              {customTitle || defaultTitle}
            </h2>
            <p className="text-xs text-[#6E5D4E] leading-relaxed">
              {customDescription || defaultDescription}
            </p>
          </div>
        )}

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {PLANS.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            return (
              <div
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={`relative rounded-xl border p-5 flex flex-col justify-between cursor-pointer transition-all duration-200 ${isSelected
                  ? 'border-[#DC6E26] bg-[#FCF3E3]/40 shadow-md ring-1 ring-[#DC6E26]/50'
                  : 'border-[#E3DAC8] bg-[#FAF7F2] hover:border-[#DC6E26]/50 hover:bg-[#F2ECE1]'
                  }`}
              >
                {plan.badge && (
                  <div className="absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full bg-[#DC6E26] text-[10px] font-mono font-semibold text-white uppercase tracking-wider shadow-xs">
                    {plan.badge}
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <h4 className="font-serif font-bold text-base text-[#23170E] flex items-center justify-between">
                      {plan.name}
                      {isSelected && <Check className="h-4 w-4 text-[#DC6E26]" />}
                    </h4>
                    <p className="text-[11px] text-[#6E5D4E] mt-1 leading-snug">
                      {plan.subtitle}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-[#E3DAC8]">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl sm:text-3xl font-serif font-extrabold text-[#23170E]">
                        {plan.id === 'yearly' && appliedPromo?.discountPercent
                          ? `₹${Math.round(3000 * (1 - appliedPromo.discountPercent / 100))}`
                          : plan.price}
                      </span>
                      <span className="text-xs text-[#736251] font-mono">/{plan.period}</span>
                    </div>
                    {plan.id === 'yearly' && appliedPromo?.discountPercent && (
                      <span className="text-[10px] text-[#2B5910] font-mono line-through mr-1">
                        ₹3,000
                      </span>
                    )}
                  </div>

                  <ul className="space-y-2 pt-3 border-t border-[#E3DAC8] text-xs">
                    {plan.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-[#23170E]">
                        <Check className="h-3.5 w-3.5 text-[#2B5910] shrink-0 mt-0.5" />
                        <span className="text-[11px] leading-relaxed">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-4 mt-4 border-t border-[#E3DAC8]">
                  <span
                    className={`block w-full py-1.5 px-3 text-center text-xs font-semibold rounded-full transition-colors ${isSelected
                      ? 'bg-[#DC6E26] text-white'
                      : 'bg-[#F2ECE1] text-[#23170E] hover:bg-[#EFE9DF]'
                      }`}
                  >
                    {plan.id === 'free' ? 'Starter Free' : isSelected ? 'Selected' : 'Choose Plan'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Promo Code Input */}
        <div className="p-4 rounded-xl border border-[#E3DAC8] bg-[#F2ECE1] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Gift className="h-4 w-4 text-[#DC6E26] shrink-0" />
            <div>
              <span className="text-xs font-semibold text-[#23170E]">Have a promotional code?</span>
              <p className="text-[11px] text-[#736251]">
                Early backers can redeem grant codes (e.g. <span className="font-mono text-[#DC6E26]">LAUNCH50</span>).
              </p>
            </div>
          </div>

          <form onSubmit={handleValidatePromo} className="flex items-center gap-2 sm:max-w-xs w-full">
            <input
              type="text"
              placeholder="Enter promo code"
              value={promoCodeInput}
              onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
              className="flex-1 px-3 py-1.5 rounded-lg border border-[#E3DAC8] bg-[#FAF7F2] text-xs font-mono text-[#23170E] placeholder-[#736251] focus:outline-none focus:border-[#DC6E26] uppercase"
            />
            <button
              type="submit"
              disabled={promoValidating || !promoCodeInput.trim()}
              className="px-4 py-1.5 rounded-full bg-[#DC6E26] hover:bg-[#C05617] text-white text-xs font-medium transition-colors disabled:opacity-50 shrink-0"
            >
              {promoValidating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Apply'}
            </button>
          </form>
        </div>

        {promoError && (
          <div className="text-xs text-[#882315] font-mono flex items-center gap-1.5 bg-[#FCECE9] border border-[#F4CFC8] p-2.5 rounded-lg">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>{promoError}</span>
          </div>
        )}

        {appliedPromo && (
          <div className="text-xs text-[#2B5910] font-mono flex items-center gap-1.5 bg-[#ECF6E3] border border-[#D4E9C1] p-2.5 rounded-lg">
            <Check className="h-3.5 w-3.5 shrink-0" />
            <span>
              Code <strong>{appliedPromo.code}</strong> applied!{' '}
              {appliedPromo.discountPercent ? `${appliedPromo.discountPercent}% off.` : ''}{' '}
              {appliedPromo.description}
            </span>
          </div>
        )}

        {/* Feedback Alerts */}
        {checkoutError && (
          <div className="p-3 rounded-lg border border-[#F4CFC8] bg-[#FCECE9] text-[#882315] text-xs font-mono flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-[#882315]" />
            <span>{checkoutError}</span>
          </div>
        )}

        {checkoutSuccess && (
          <div className="p-3 rounded-lg border border-[#D4E9C1] bg-[#ECF6E3] text-[#2B5910] text-xs font-mono flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0 text-[#2B5910]" />
            <span>{checkoutSuccess}</span>
          </div>
        )}

        {/* Payment Gateway Actions */}
        <div className="pt-4 border-t border-[#E3DAC8] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-[#736251] flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#2B5910] shrink-0" />
            <span>Secured via Razorpay Checkout (256-bit SSL encryption in INR).</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={checkoutLoading || verifying}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-full border border-[#E3DAC8] bg-[#F2ECE1] hover:bg-[#EFE9DF] text-[#23170E] text-xs font-medium transition-colors disabled:opacity-50"
            >
              Continue on Free Plan
            </button>
            <button
              type="button"
              onClick={handleCheckout}
              disabled={checkoutLoading || verifying}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#DC6E26] hover:bg-[#C05617] text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {checkoutLoading || verifying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{verifying ? 'Verifying Payment...' : 'Connecting Gateway...'}</span>
                </>
              ) : selectedPlan === 'free' ? (
                <span>Stay on Free Tier</span>
              ) : (
                <>
                  <CreditCard className="h-4 w-4" />
                  <span>
                    Pay {selectedPlan === 'yearly' ? '₹3,000/yr' : '₹9,999'} &amp; Upgrade
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
