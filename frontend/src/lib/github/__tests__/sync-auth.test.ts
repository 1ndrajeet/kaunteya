import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
  hasServiceRoleKey: vi.fn(() => true),
}));

vi.mock('@/lib/github/sync', () => ({
  syncRepositoryEvidence: vi.fn().mockResolvedValue({
    success: true,
    artifactsSyncedCount: 5,
    matchedClaimsCount: 1,
  }),
}));

import { POST } from '@/app/api/github/sync/route';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServiceClient, hasServiceRoleKey } from '@/lib/supabase/service';
import { syncRepositoryEvidence } from '@/lib/github/sync';

describe('GitHub Sync Route Authorization (POST /api/github/sync)', () => {
  const workspaceId = '00000000-0000-0000-0000-000000000001';
  const repositoryId = '00000000-0000-0000-0000-000000000002';
  const userId = 'user-test-123';
  const cronSecret = 'super-secret-cron-token-999';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = cronSecret;
    (hasServiceRoleKey as any).mockReturnValue(true);
  });

  describe('User-Triggered Synchronization Path', () => {
    it('rejects unauthenticated user session with 401', async () => {
      (createServerSupabaseClient as any).mockResolvedValue({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      });

      const req = new NextRequest('http://localhost:3000/api/github/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, repositoryId }),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.code).toBe('UNAUTHENTICATED');
    });

    it('rejects user without workspace membership with 403', async () => {
      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } } }) },
        from: vi.fn((table: string) => {
          if (table === 'workspace_members') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null }), // not a member
            };
          }
          return {};
        }),
      };
      (createServerSupabaseClient as any).mockResolvedValue(mockSupabase);

      const req = new NextRequest('http://localhost:3000/api/github/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, repositoryId }),
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.code).toBe('FORBIDDEN');
    });

    it('allows authenticated member to trigger sync for an enabled repository', async () => {
      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } } }) },
        from: vi.fn((table: string) => {
          if (table === 'workspace_members') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'member' } }),
            };
          }
          if (table === 'github_repositories') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: repositoryId,
                  workspace_id: workspaceId,
                  is_enabled: true,
                  sync_status: 'idle',
                  installation: { id: 'inst-1', connection_status: 'active' },
                },
                error: null,
              }),
            };
          }
          return {};
        }),
      };
      (createServerSupabaseClient as any).mockResolvedValue(mockSupabase);
      (createServiceClient as any).mockReturnValue(mockSupabase);

      const req = new NextRequest('http://localhost:3000/api/github/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, repositoryId }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.authContext).toBe('user');
      expect(syncRepositoryEvidence).toHaveBeenCalled();
    });

    it('returns 409 conflict if a synchronization is currently in progress', async () => {
      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } } }) },
        from: vi.fn((table: string) => {
          if (table === 'workspace_members') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'admin' } }),
            };
          }
          if (table === 'github_repositories') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: repositoryId,
                  workspace_id: workspaceId,
                  is_enabled: true,
                  sync_status: 'syncing',
                  updated_at: new Date().toISOString(), // ongoing active sync
                  installation: { id: 'inst-1', connection_status: 'active' },
                },
                error: null,
              }),
            };
          }
          return {};
        }),
      };
      (createServerSupabaseClient as any).mockResolvedValue(mockSupabase);
      (createServiceClient as any).mockReturnValue(mockSupabase);

      const req = new NextRequest('http://localhost:3000/api/github/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, repositoryId }),
      });

      const res = await POST(req);
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.code).toBe('SYNC_IN_PROGRESS');
      expect(syncRepositoryEvidence).not.toHaveBeenCalled();
    });
  });

  describe('Scheduled / Cron Synchronization Path', () => {
    it('rejects invalid or missing cron token with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/github/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer invalid-token',
        },
        body: JSON.stringify({ workspaceId, repositoryId }),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.code).toBe('INVALID_CRON_CREDENTIALS');
    });

    it('rejects cron requests if CRON_SECRET is not configured on the server', async () => {
      delete process.env.CRON_SECRET;

      const req = new NextRequest('http://localhost:3000/api/github/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer some-token',
        },
        body: JSON.stringify({ workspaceId, repositoryId }),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.code).toBe('CRON_NOT_CONFIGURED');
    });

    it('accepts valid cron credential and executes synchronization', async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'github_repositories') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: repositoryId,
                  workspace_id: workspaceId,
                  is_enabled: true,
                  sync_status: 'idle',
                  installation: { id: 'inst-1', connection_status: 'active' },
                },
                error: null,
              }),
            };
          }
          return {};
        }),
      };
      (createServiceClient as any).mockReturnValue(mockSupabase);

      const req = new NextRequest('http://localhost:3000/api/github/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cronSecret}`,
        },
        body: JSON.stringify({ workspaceId, repositoryId }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.authContext).toBe('cron');
      expect(syncRepositoryEvidence).toHaveBeenCalled();
    });
  });
});
