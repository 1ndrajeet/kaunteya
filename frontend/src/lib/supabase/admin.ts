import { createServiceClient } from './service';

/**
 * Creates a privileged Supabase administrative client with service-role permissions.
 * Bypasses Row Level Security (RLS) for trusted server-side webhooks and auth flows.
 */
export function createAdminClient() {
  return createServiceClient();
}
