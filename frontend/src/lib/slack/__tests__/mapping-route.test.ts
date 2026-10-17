import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
  hasServiceRoleKey: vi.fn(() => true),
}));

const mockAuthTest = vi.fn().mockResolvedValue({
  ok: true,
  team_id: 'T0C9MTFPR43',
  team: '1ndrajeet',
  user_id: 'U0C9TBD4T8T',
});

const mockUsersInfo = vi.fn().mockResolvedValue({
  ok: true,
  user: {
    id: 'U0C9NRMSXUM',
    name: 'omkar.kulkarni.3174',
    real_name: 'Omkar Kulkarni',
    profile: {
      email: 'omkar.kulkarni.3174@gmail.com',
      real_name: 'Omkar Kulkarni',
    },
  },
});

vi.mock('@slack/web-api', () => {
  class MockWebClient {
    auth = { test: mockAuthTest };
    users = { info: mockUsersInfo };
  }
  return { WebClient: MockWebClient };
});

import { POST as mappingPost, DELETE as mappingDelete, GET as mappingGet } from '@/app/api/slack/mapping/route';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServiceClient, hasServiceRoleKey } from '@/lib/supabase/service';

describe('Slack Mapping Route (/api/slack/mapping)', () => {
  const workspaceA = '885aaa08-8a68-49e9-9d86-e52ee69f0137';
  const workspaceB = '8c6f1835-f0ae-43fd-b318-707f4765efda';
  const adminUserId = 'user-admin-omkar';
  const strangerUserId = 'user-stranger-other-ws';
  const targetMemberId = 'user-target-member';

  beforeEach(() => {
    vi.clearAllMocks();
    (hasServiceRoleKey as any).mockReturnValue(true);
    process.env.SLACK_BOT_TOKEN = 'xoxb-mock-bot-token';
  });

  describe('POST /api/slack/mapping - Identity Mapping & Workspace Isolation', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      };
      (createServerSupabaseClient as any).mockResolvedValue(mockSupabase);

      const req = new NextRequest('http://localhost:3000/api/slack/mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspaceA,
          userId: targetMemberId,
          slackUserId: 'U0C9NRMSXUM',
        }),
      });

      const res = await mappingPost(req);
      expect(res.status).toBe(401);
    });

    it('rejects non-admin workspace members with 403', async () => {
      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'regular-member' } } }) },
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

      const req = new NextRequest('http://localhost:3000/api/slack/mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspaceA,
          userId: targetMemberId,
          slackUserId: 'U0C9NRMSXUM',
        }),
      });

      const res = await mappingPost(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('Only workspace admins');
    });

    it('enforces cross-workspace isolation: rejects mapping target user not in this workspace with 404', async () => {
      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: adminUserId } } }) },
        from: vi.fn((table: string) => {
          if (table === 'workspace_members') {
            const memberChain: any = {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockImplementation((col: string, val: string) => {
                if (col === 'user_id') {
                  if (val === adminUserId) {
                    return { maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'admin' } }) };
                  }
                  if (val === strangerUserId) {
                    return { maybeSingle: vi.fn().mockResolvedValue({ data: null }) };
                  }
                }
                return memberChain;
              }),
              maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            };
            return memberChain;
          }
          return {};
        }),
      };
      (createServerSupabaseClient as any).mockResolvedValue(mockSupabase);

      const req = new NextRequest('http://localhost:3000/api/slack/mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspaceA,
          userId: strangerUserId,
          slackUserId: 'U0C9NRMSXUM',
        }),
      });

      const res = await mappingPost(req);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toContain('Target user is not an active member of this workspace');
    });

    it('persists Slack identity mapping and auto-creates installation for workspace if missing', async () => {
      let createdInstallation: any = null;
      let createdMapping: any = null;

      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: adminUserId } } }) },
        from: vi.fn((table: string) => {
          if (table === 'workspace_members') {
            const memberChain: any = {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockImplementation((col: string, val: string) => {
                if (col === 'user_id') {
                  if (val === adminUserId) {
                    return { maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'admin' } }) };
                  }
                  if (val === targetMemberId) {
                    return {
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: {
                          user_id: targetMemberId,
                          role: 'member',
                          profiles: { id: targetMemberId, display_name: 'Target Member', email: 'target@test.com' },
                        },
                      }),
                    };
                  }
                }
                return memberChain;
              }),
              maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            };
            return memberChain;
          }
          if (table === 'slack_installations') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null }), // no installation yet
              upsert: vi.fn().mockImplementation((payload) => {
                createdInstallation = payload;
                return {
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: { id: 'inst-ws-a-1', ...payload },
                      error: null,
                    }),
                  }),
                };
              }),
            };
          }
          if (table === 'slack_installation_secrets') {
            return {
              upsert: vi.fn().mockResolvedValue({ error: null }),
            };
          }
          if (table === 'slack_user_mappings') {
            return {
              upsert: vi.fn().mockImplementation((payload) => {
                createdMapping = payload;
                return {
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: { id: 'map-ws-a-1', ...payload },
                      error: null,
                    }),
                  }),
                };
              }),
            };
          }
          if (table === 'activity_events') {
            return {
              insert: vi.fn().mockResolvedValue({ error: null }),
            };
          }
          return {};
        }),
      };
      (createServerSupabaseClient as any).mockResolvedValue(mockSupabase);
      (createServiceClient as any).mockReturnValue(mockSupabase);

      const req = new NextRequest('http://localhost:3000/api/slack/mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspaceA,
          userId: targetMemberId,
          slackUserId: 'u0c9nrmsxum',
          slackUsername: '@omkar.kulkarni.3174',
        }),
      });

      const res = await mappingPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.ok).toBe(true);
      expect(createdInstallation.workspace_id).toBe(workspaceA);
      expect(createdInstallation.slack_team_id).toBe('T0C9MTFPR43');
      expect(createdMapping.workspace_id).toBe(workspaceA);
      expect(createdMapping.slack_user_id).toBe('U0C9NRMSXUM'); // normalized uppercase
      expect(createdMapping.taskpilot_user_id).toBe(targetMemberId);
      expect(createdMapping.link_status).toBe('linked');
      expect(createdMapping.slack_email).toBe('omkar.kulkarni.3174@gmail.com');
    });
  });

  describe('DELETE /api/slack/mapping - Unlink Identity', () => {
    it('unlinks member identity when requested by workspace admin', async () => {
      let deletedMappingId: string | null = null;

      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: adminUserId } } }) },
        from: vi.fn((table: string) => {
          if (table === 'workspace_members') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'admin' } }),
            };
          }
          if (table === 'slack_user_mappings') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: 'map-123',
                  workspace_id: workspaceA,
                  slack_user_id: 'U0C9NRMSXUM',
                  taskpilot_user_id: targetMemberId,
                  profiles: { display_name: 'Target Member' },
                },
              }),
              delete: vi.fn().mockImplementation(() => ({
                eq: vi.fn().mockImplementation((col: string, val: string) => {
                  if (col === 'id') deletedMappingId = val;
                  return { eq: vi.fn().mockResolvedValue({ error: null }) };
                }),
              })),
            };
          }
          if (table === 'activity_events') {
            return { insert: vi.fn().mockResolvedValue({ error: null }) };
          }
          return {};
        }),
      };
      (createServerSupabaseClient as any).mockResolvedValue(mockSupabase);
      (createServiceClient as any).mockReturnValue(mockSupabase);

      const req = new NextRequest('http://localhost:3000/api/slack/mapping', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspaceA,
          mappingId: 'map-123',
        }),
      });

      const res = await mappingDelete(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(deletedMappingId).toBe('map-123');
    });
  });
});
