-- ==============================================================================
-- Migration: 20261017000003_workspace_monetization_razorpay.sql
-- Description: Production workspace monetization & Razorpay integration
--              - Lifetime workspace creation tracking on profiles (prevents deletion bypass)
--              - User entitlements table for commercial plan validity & expiry
--              - Payments ledger table with Razorpay order, payment, and signature tracking
--              - ₹3,000 INR (300,000 paise) annual Pro plan configuration
--              - Atomic PostgreSQL workspace limit enforcement with row-level serialization
-- ==============================================================================

-- 1. ADD WORKSPACE CREATION TRACKER TO PROFILES
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS workspaces_created_count INT NOT NULL DEFAULT 0;

-- Backfill existing created counts for current users
UPDATE public.profiles p
SET workspaces_created_count = (
    SELECT COUNT(*) FROM public.workspaces w WHERE w.created_by = p.id
)
WHERE p.workspaces_created_count = 0;

-- 2. CREATE PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
    razorpay_order_id TEXT UNIQUE,
    razorpay_payment_id TEXT UNIQUE,
    razorpay_signature TEXT,
    amount_paise INT NOT NULL DEFAULT 300000,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'authorized', 'captured', 'failed', 'refunded')),
    plan_id TEXT NOT NULL DEFAULT 'yearly',
    receipt TEXT,
    notes JSONB DEFAULT '{}'::jsonb,
    error_code TEXT,
    error_description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order_id ON public.payments(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_payment_id ON public.payments(razorpay_payment_id);

-- 3. CREATE USER ENTITLEMENTS TABLE
CREATE TABLE IF NOT EXISTS public.user_entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES public.plans(id) DEFAULT 'yearly',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
    max_workspaces INT NOT NULL DEFAULT 10,
    valid_from TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    valid_until TIMESTAMPTZ NOT NULL,
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_user_entitlements_lookup 
ON public.user_entitlements (user_id, status, valid_until);

-- 4. ROW LEVEL SECURITY POLICIES
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payments_user_view ON public.payments;
CREATE POLICY payments_user_view ON public.payments
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_entitlements_user_view ON public.user_entitlements;
CREATE POLICY user_entitlements_user_view ON public.user_entitlements
    FOR SELECT USING (auth.uid() = user_id);

-- Grants
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

GRANT SELECT ON public.user_entitlements TO authenticated;
GRANT ALL ON public.user_entitlements TO service_role;

-- 5. UPSERT AUTHORITATIVE COMMERCIAL PLANS (₹3,000 INR = 300,000 PAISE)
INSERT INTO public.plans (id, name, description, price_cents, currency, billing_interval, max_workspaces, max_projects_per_workspace, features)
VALUES
    ('free', 'Starter Free', 'Essential tooling for individual builders and hackathon teams.', 0, 'INR', 'free', 1, 5, '["1 Free Workspace", "Up to 5 Projects per Workspace", "Project-Scoped Teams", "Slack & GitHub Integration", "Standard Activity Audit Trail"]'::jsonb),
    ('yearly', 'Pro Yearly', 'Comprehensive delivery coordination for scaling organizations.', 300000, 'INR', 'yearly', 10, 50, '["Up to 10 Workspaces", "Up to 50 Projects per Workspace", "Priority GitHub Webhooks", "Advanced Gemini Insights", "Audit Log Retention", "Team Workload Analytics"]'::jsonb),
    ('onetime', 'Founder Lifetime', 'Single investment for permanent autonomous project coordination.', 999900, 'INR', 'lifetime', 999, 999, '["Unlimited Workspaces", "Unlimited Projects", "Dedicated Support", "Full Gemini Intelligence Access", "All Future Pro Features"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price_cents = EXCLUDED.price_cents,
    currency = EXCLUDED.currency,
    billing_interval = EXCLUDED.billing_interval,
    max_workspaces = EXCLUDED.max_workspaces,
    max_projects_per_workspace = EXCLUDED.max_projects_per_workspace,
    features = EXCLUDED.features;

-- 6. ATOMIC WORKSPACE CREATION ENFORCING FREE ALLOWANCE & PAID ENTITLEMENT
CREATE OR REPLACE FUNCTION public.create_workspace_with_admin(
    p_name TEXT,
    p_slug TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_workspace_id UUID;
    v_lifetime_created INT;
    v_active_workspaces INT;
    v_max_allowed INT := 1; -- 1 free workspace by default
    v_has_active_entitlement BOOLEAN := false;
    v_entitlement_max INT;
    v_result JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN 
        RAISE EXCEPTION 'Not authenticated'; 
    END IF;

    -- Ensure profile exists
    INSERT INTO public.profiles (id, email, display_name, avatar_url, workspaces_created_count)
    VALUES (
        v_user_id,
        auth.jwt() ->> 'email',
        COALESCE(
            auth.jwt() -> 'user_metadata' ->> 'full_name',
            auth.jwt() -> 'user_metadata' ->> 'name',
            split_part(auth.jwt() ->> 'email', '@', 1),
            'User'
        ),
        auth.jwt() -> 'user_metadata' ->> 'avatar_url',
        0
    )
    ON CONFLICT (id) DO UPDATE SET updated_at = timezone('utc'::text, now());

    -- Lock the user profile row to serialize workspace creation & prevent concurrent limit bypass
    SELECT COALESCE(workspaces_created_count, 0)
    INTO v_lifetime_created
    FROM public.profiles
    WHERE id = v_user_id
    FOR UPDATE;

    -- Also check existing active workspaces created by user to ensure consistency
    SELECT COUNT(*) INTO v_active_workspaces
    FROM public.workspaces
    WHERE created_by = v_user_id;

    -- If lifetime counter is lower than current active workspaces, sync it up
    IF v_active_workspaces > v_lifetime_created THEN
        v_lifetime_created := v_active_workspaces;
    END IF;

    -- Check if user has an active, valid paid entitlement
    SELECT max_workspaces INTO v_entitlement_max
    FROM public.user_entitlements
    WHERE user_id = v_user_id
      AND status = 'active'
      AND valid_until > timezone('utc'::text, now())
    ORDER BY valid_until DESC
    LIMIT 1;

    IF v_entitlement_max IS NOT NULL THEN
        v_has_active_entitlement := true;
        v_max_allowed := v_entitlement_max;
    END IF;

    -- Enforce workspace creation limit:
    -- User is creating their (v_lifetime_created + 1)-th workspace.
    -- If lifetime created >= v_max_allowed, reject with stable WORKSPACE_LIMIT_EXCEEDED error.
    IF v_lifetime_created >= v_max_allowed THEN
        IF NOT v_has_active_entitlement THEN
            RAISE EXCEPTION 'WORKSPACE_LIMIT_EXCEEDED: You have reached the maximum allowed workspaces (1) on the Free plan. Please upgrade to Pro Yearly (₹3,000/year) to provision additional workspaces.'
            USING ERRCODE = 'P0001';
        ELSE
            RAISE EXCEPTION 'WORKSPACE_LIMIT_EXCEEDED: You have reached your commercial plan limit of % workspaces. Please contact support or upgrade for higher capacity.', v_max_allowed
            USING ERRCODE = 'P0001';
        END IF;
    END IF;

    -- Create workspace
    INSERT INTO public.workspaces (name, slug, created_by)
    VALUES (p_name, lower(trim(p_slug)), v_user_id)
    RETURNING id INTO v_workspace_id;

    -- Increment user lifetime created counter (persists even if workspace is later deleted)
    UPDATE public.profiles
    SET workspaces_created_count = v_lifetime_created + 1,
        updated_at = timezone('utc'::text, now())
    WHERE id = v_user_id;

    -- Assign creator as Admin
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (v_workspace_id, v_user_id, 'admin')
    ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'admin';

    -- Assign initial subscription
    INSERT INTO public.workspace_subscriptions (workspace_id, plan_id, status)
    VALUES (v_workspace_id, CASE WHEN v_has_active_entitlement THEN 'yearly' ELSE 'free' END, 'active')
    ON CONFLICT (workspace_id) DO NOTHING;

    -- Record activity
    INSERT INTO public.activity_events (
        workspace_id, actor_id, entity_type, entity_id, event_type, metadata
    )
    VALUES (
        v_workspace_id, v_user_id, 'workspace', v_workspace_id, 'created',
        jsonb_build_object('name', p_name, 'slug', p_slug, 'plan', CASE WHEN v_has_active_entitlement THEN 'yearly' ELSE 'free' END)
    );

    SELECT jsonb_build_object('id', w.id, 'name', w.name, 'slug', w.slug, 'role', 'admin')
    INTO v_result FROM public.workspaces w WHERE w.id = v_workspace_id;

    RETURN v_result;
END;
$$;
