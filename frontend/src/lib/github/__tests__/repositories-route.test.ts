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

import { GET } from '@/app/api/github/repositories/route';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getInstallationOctokit } from '@/lib/github/app-auth';

describe('Repository Listing Route (GET /api/github/repositories)', () => {
  const workspaceId = '11111111-1111-1111-1111-111111111111';
  const userId = 'user-test-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 if user is unauthenticated', async () => {
    (createServerSupabaseClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });

    const req = new NextRequest(`http://localhost:3000/api/github/repositories?workspaceId=${workspaceId}`);
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it('returns 403 if user is not a member of the workspace', async () => {
    const mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } } }) },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }), // not a member
      })),
    };
    (createServerSupabaseClient as any).mockResolvedValue(mockSupabase);

    const req = new NextRequest(`http://localhost:3000/api/github/repositories?workspaceId=${workspaceId}`);
    const res = await GET(req);

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.code).toBe('FORBIDDEN');
  });

  it('returns 404 with structured contract if workspace has no GitHub installation', async () => {
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
        if (table === 'github_installations') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }), // no installation
          };
        }
        return {};
      }),
    };
    (createServerSupabaseClient as any).mockResolvedValue(mockSupabase);
    (createServiceClient as any).mockReturnValue(mockSupabase);

    const req = new NextRequest(`http://localhost:3000/api/github/repositories?workspaceId=${workspaceId}`);
    const res = await GET(req);

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.code).toBe('NO_INSTALLATION');
    expect(data.connected).toBe(false);
    expect(data.repositories).toEqual([]);
  });

  it('returns 403 if GitHub installation is suspended or revoked', async () => {
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
        if (table === 'github_installations') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'inst-1', connection_status: 'suspended' },
              error: null,
            }),
          };
        }
        return {};
      }),
    };
    (createServerSupabaseClient as any).mockResolvedValue(mockSupabase);
    (createServiceClient as any).mockReturnValue(mockSupabase);

    const req = new NextRequest(`http://localhost:3000/api/github/repositories?workspaceId=${workspaceId}`);
    const res = await GET(req);

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.code).toBe('INSTALLATION_INACTIVE');
    expect(data.status).toBe('suspended');
  });

  it('paginates over multiple pages and returns all repositories when count exceeds 100', async () => {
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
        if (table === 'github_installations') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: 'inst-1',
                workspace_id: workspaceId,
                github_installation_id: 12345,
                account_login: 'acme-org',
                connection_status: 'active',
              },
              error: null,
            }),
          };
        }
        if (table === 'github_repositories') {
          return {
            upsert: vi.fn().mockResolvedValue({ error: null }),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: [] }),
            update: vi.fn().mockReturnThis(),
          };
        }
        return {};
      }),
    };
    (createServerSupabaseClient as any).mockResolvedValue(mockSupabase);
    (createServiceClient as any).mockReturnValue(mockSupabase);

    // Mock 120 total repositories across 2 pages (100 on page 1, 20 on page 2)
    const page1Repos = Array.from({ length: 100 }, (_, i) => ({
      id: 1000 + i,
      name: `repo-${i}`,
      full_name: `acme-org/repo-${i}`,
      html_url: `https://github.com/acme-org/repo-${i}`,
      private: false,
      default_branch: 'main',
    }));
    const page2Repos = Array.from({ length: 20 }, (_, i) => ({
      id: 2000 + i,
      name: `repo-extra-${i}`,
      full_name: `acme-org/repo-extra-${i}`,
      html_url: `https://github.com/acme-org/repo-extra-${i}`,
      private: true,
      default_branch: 'master',
    }));

    const mockOctokit = {
      apps: {
        listReposAccessibleToInstallation: vi.fn().mockImplementation(({ page }) => {
          if (page === 1) {
            return Promise.resolve({
              data: { total_count: 120, repositories: page1Repos },
            });
          }
          return Promise.resolve({
            data: { total_count: 120, repositories: page2Repos },
          });
        }),
      },
    };
    (getInstallationOctokit as any).mockResolvedValue(mockOctokit);

    const req = new NextRequest(`http://localhost:3000/api/github/repositories?workspaceId=${workspaceId}`);
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.connected).toBe(true);
    expect(data.repositories.length).toBe(120);
    expect(mockOctokit.apps.listReposAccessibleToInstallation).toHaveBeenCalledTimes(2);
  });

  it('handles GitHub API rate limiting gracefully by returning 429 with reset time', async () => {
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
        if (table === 'github_installations') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'inst-1', github_installation_id: 12345, connection_status: 'active' },
              error: null,
            }),
            update: vi.fn().mockReturnThis(),
          };
        }
        return {};
      }),
    };
    (createServerSupabaseClient as any).mockResolvedValue(mockSupabase);
    (createServiceClient as any).mockReturnValue(mockSupabase);

    const rateLimitError: any = new Error('API rate limit exceeded');
    rateLimitError.status = 403;
    rateLimitError.response = {
      headers: {
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': '1893456000',
      },
    };

    (getInstallationOctokit as any).mockResolvedValue({
      apps: {
        listReposAccessibleToInstallation: vi.fn().mockRejectedValue(rateLimitError),
      },
    });

    const req = new NextRequest(`http://localhost:3000/api/github/repositories?workspaceId=${workspaceId}`);
    const res = await GET(req);

    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.code).toBe('RATE_LIMITED');
    expect(data.reset_at).toBeDefined();
  });
});
