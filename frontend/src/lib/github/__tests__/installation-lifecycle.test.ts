import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
  hasServiceRoleKey: vi.fn(() => true),
}));

vi.mock('@/lib/github/app-auth', () => ({
  getInstallationOctokit: vi.fn(),
}));

vi.mock('@octokit/rest', () => {
  class MockOctokit {
    apps = {
      getInstallation: vi.fn().mockResolvedValue({
        data: {
          id: 999123,
          account: { login: 'acme-org', type: 'Organization', avatar_url: 'https://avatar.url' },
          permissions: { metadata: 'read', contents: 'read', pull_requests: 'read' },
        },
      }),
      listReposAccessibleToInstallation: vi.fn().mockResolvedValue({
        data: { total_count: 1, repositories: [{ id: 101, name: 'repo-1', full_name: 'acme-org/repo-1', html_url: 'https://github.com/acme-org/repo-1', private: false }] },
      }),
    };
  }
  return { Octokit: MockOctokit };
});

import { POST as installPost } from '@/app/api/github/install/route';
import { GET as callbackGet } from '@/app/api/github/callback/route';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getInstallationOctokit } from '@/lib/github/app-auth';

describe('GitHub App Installation Lifecycle', () => {
  const workspaceId = '00000000-0000-0000-0000-000000000001';
  const userId = 'user-admin-123';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GITHUB_APP_SLUG = 'taskpilot-app';
    process.env.GITHUB_APP_ID = '12345';
    process.env.GITHUB_APP_PRIVATE_KEY = 'mock-private-key';
  });

  describe('Installation Start (POST /api/github/install)', () => {
    it('allows a workspace admin to initiate installation and returns installUrl with CSRF state', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } } }),
        },
        from: vi.fn((table: string) => {
          if (table === 'workspace_members') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'admin' } }),
            };
          }
          if (table === 'github_oauth_states') {
            return {
              insert: vi.fn().mockResolvedValue({ error: null }),
            };
          }
          return {};
        }),
      };
      (createServerSupabaseClient as any).mockResolvedValue(mockSupabase);

      const req = new NextRequest('http://localhost:3000/api/github/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });

      const res = await installPost(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.installUrl).toBeDefined();
      expect(data.installUrl).toContain('https://github.com/apps/taskpilot-app/installations/new?state=');
    });

    it('denies non-admin workspace members from initiating installation', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'member-user' } } }),
        },
        from: vi.fn((table: string) => {
          if (table === 'workspace_members') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'member' } }),
            };
          }
          return {};
        }),
      };
      (createServerSupabaseClient as any).mockResolvedValue(mockSupabase);

      const req = new NextRequest('http://localhost:3000/api/github/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });

      const res = await installPost(req);
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toContain('Only workspace admins');
    });

    it('rejects unauthenticated requests with 401', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      };
      (createServerSupabaseClient as any).mockResolvedValue(mockSupabase);

      const req = new NextRequest('http://localhost:3000/api/github/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });

      const res = await installPost(req);
      expect(res.status).toBe(401);
    });
  });

  describe('Installation Callback (GET /api/github/callback)', () => {
    it('validates state token, consumes it atomically, persists installation, and redirects', async () => {
      const stateToken = 'valid-csrf-token-12345';
      const installationId = '999123';

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } } }),
        },
        from: vi.fn((table: string) => {
          if (table === 'github_oauth_states') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              is: vi.fn().mockReturnThis(),
              gt: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: 'state-id-1',
                  workspace_id: workspaceId,
                  initiated_by: userId,
                  consumed_at: null,
                },
                error: null,
              }),
              update: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            };
          }
          if (table === 'workspace_members') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'admin' } }),
            };
          }
          if (table === 'github_installations') {
            return {
              upsert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: 'inst-row-1', workspace_id: workspaceId, github_installation_id: 999123 },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'github_installation_secrets' || table === 'activity_events' || table === 'github_repositories') {
            return {
              upsert: vi.fn().mockResolvedValue({ error: null }),
              insert: vi.fn().mockResolvedValue({ error: null }),
            };
          }
          return {};
        }),
      };

      (createServerSupabaseClient as any).mockResolvedValue(mockSupabase);
      (createServiceClient as any).mockReturnValue(mockSupabase);
      (getInstallationOctokit as any).mockResolvedValue({
        apps: {
          listReposAccessibleToInstallation: vi.fn().mockResolvedValue({
            data: { total_count: 0, repositories: [] },
          }),
        },
      });

      const req = new NextRequest(
        `http://localhost:3000/api/github/callback?installation_id=${installationId}&state=${stateToken}&setup_action=install`
      );

      const res = await callbackGet(req);

      expect(res.status).toBe(307); // redirect
      const location = res.headers.get('location');
      expect(location).toContain(`/workspace/${workspaceId}/admin/integrations?github_connected=1`);
    });

    it('rejects invalid or expired state token with redirect error', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } } }),
        },
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          gt: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }), // invalid state
        })),
      };
      (createServerSupabaseClient as any).mockResolvedValue(mockSupabase);

      const req = new NextRequest(
        `http://localhost:3000/api/github/callback?installation_id=123&state=tampered-state`
      );

      const res = await callbackGet(req);
      const location = res.headers.get('location');
      expect(location).toContain('github_error=invalid_state');
    });
  });
});
