import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Creates a server-side Supabase client for internal webhook and background event processing.
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY if available (server-only), falling back to public/anon key
 * for local environments.
 */
export function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co';
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    'placeholder-anon-key';

  return createClient<Database>(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
