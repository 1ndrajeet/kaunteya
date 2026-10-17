/**
 * TaskPilot — Authoritative Commercial Plans & Pricing Configuration
 *
 * Monetary amounts are strictly integer minor units (paise for INR).
 * 1 INR = 100 paise.
 * ₹3,000.00 INR = 300,000 paise.
 */

export interface CommercialPlan {
  id: string;
  name: string;
  subtitle: string;
  amountPaise: number;
  currency: 'INR';
  billingInterval: 'free' | 'yearly' | 'lifetime';
  durationDays: number | null; // null for free/lifetime
  maxWorkspaces: number;
  maxProjectsPerWorkspace: number;
  badge?: string;
  popular?: boolean;
  features: string[];
}

export const COMMERCIAL_PLANS: Record<string, CommercialPlan> = {
  free: {
    id: 'free',
    name: 'Starter Free',
    subtitle: 'Essential coordination for individual builders & small squads',
    amountPaise: 0,
    currency: 'INR',
    billingInterval: 'free',
    durationDays: null,
    maxWorkspaces: 1,
    maxProjectsPerWorkspace: 5,
    features: [
      '1 Workspace per user account',
      'Up to 5 Projects per workspace',
      'Project-scoped teams & team leads',
      'Slack intake & automated follow-ups',
      'GitHub repository evidence linking',
      'Standard activity audit trail',
    ],
  },
  yearly: {
    id: 'yearly',
    name: 'Pro Yearly',
    subtitle: 'High-throughput delivery coordination for engineering teams',
    amountPaise: 300000, // ₹3,000.00 INR (300,000 paise)
    currency: 'INR',
    billingInterval: 'yearly',
    durationDays: 365,
    maxWorkspaces: 10,
    maxProjectsPerWorkspace: 50,
    badge: 'Recommended',
    popular: true,
    features: [
      'Up to 10 Workspaces',
      'Up to 50 Projects per workspace',
      'Unlimited project teams & members',
      'Priority GitHub webhook ingestion',
      'Gemini AI autonomous task routing',
      'Automated claim-to-evidence matching',
      'Extended audit log retention',
    ],
  },
  onetime: {
    id: 'onetime',
    name: 'Founder Lifetime',
    subtitle: 'Single investment for permanent autonomous execution',
    amountPaise: 999900, // ₹9,999.00 INR (999,900 paise)
    currency: 'INR',
    billingInterval: 'lifetime',
    durationDays: 36500, // 100 years
    maxWorkspaces: 999,
    maxProjectsPerWorkspace: 999,
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
};

/**
 * Validates and retrieves a trusted commercial plan by ID.
 * Returns undefined if plan ID is unrecognized or invalid.
 */
export function getCommercialPlan(planId: string): CommercialPlan | undefined {
  return COMMERCIAL_PLANS[planId];
}

/**
 * Formats paise into Indian Rupee currency string (e.g. 300000 -> "₹3,000")
 */
export function formatINR(amountPaise: number): string {
  const rupees = amountPaise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(rupees);
}
