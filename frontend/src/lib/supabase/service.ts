import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Checks if the server environment has the service-role key configured.
 */
export function hasServiceRoleKey(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Creates a server-side Supabase client for internal webhook and background event processing.
 *
 * MUST use SUPABASE_SERVICE_ROLE_KEY to bypass Row Level Security for trusted background workflows.
 * Fails closed if SUPABASE_SERVICE_ROLE_KEY is absent rather than silently falling back to anon key.
 */
export function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    throw new Error(
      '[Supabase Service Client] SUPABASE_SERVICE_ROLE_KEY is missing in server environment. Elevated service-role operations cannot proceed.'
    );
  }

  return createClient<Database>(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export const getServiceRoleClient = createServiceClient;
