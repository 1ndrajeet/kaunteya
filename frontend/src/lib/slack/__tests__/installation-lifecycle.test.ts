import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
  hasServiceRoleKey: vi.fn(() => true),
}));

const mockAuthTest = vi.fn();
const mockUsersInfo = vi.fn();
const mockUsersList = vi.fn();

vi.mock('@slack/web-api', () => {
  class MockWebClient {
    auth = { test: mockAuthTest };
    users = { info: mockUsersInfo, list: mockUsersList };
  }
  return { WebClient: MockWebClient };
});

import { GET as installGet, POST as installPost } from '@/app/api/slack/install/route';
import { GET as callbackGet } from '@/app/api/slack/callback/route';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServiceClient, hasServiceRoleKey } from '@/lib/supabase/service';

describe('Slack OAuth & Installation Lifecycle', () => {
  const workspaceId = '00000000-0000-0000-0000-000000000001';
  const adminUserId = 'user-admin-123';
  const memberUserId = 'user-member-456';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SLACK_CLIENT_ID = 'slack-client-id-123';
    process.env.SLACK_CLIENT_SECRET = 'slack-client-secret-xyz';
    process.env.SLACK_SIGNING_SECRET = 'slack-signing-secret-abc';
    process.env.SLACK_REDIRECT_URI = 'http://localhost:3000/api/slack/callback';
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
    (hasServiceRoleKey as any).mockReturnValue(true);
  });

  describe('Installation Start (GET /api/slack/install)', () => {
    it('requires workspaceId query parameter', async () => {
      const req = new NextRequest('http://localhost:3000/api/slack/install');
      const res = await installGet(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('workspaceId');
    });

    it('redirects to /login if unauthenticated', async () => {
      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      };
      (createServerSupabaseClient as any).mockResolvedValue(mockSupabase);

      const req = new NextRequest(`http://localhost:3000/api/slack/install?workspaceId=${workspaceId}`);
      const res = await installGet(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/login');
    });

    it('rejects non-admin members with 403', async () => {
      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: memberUserId } } }) },
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'member' } }),
        })),
      };
      (createServerSupabaseClient as any).mockResolvedValue(mockSupabase);

      const req = new NextRequest(`http://localhost:3000/api/slack/install?workspaceId=${workspaceId}`);
      const res = await installGet(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('Only workspace admins');
    });

    it('creates OAuth state and redirects to Slack authorize URL', async () => {
      let insertedState: any = null;
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
          if (table === 'slack_oauth_states') {
            return {
              insert: vi.fn().mockImplementation((payload) => {
                insertedState = payload;
                return Promise.resolve({ error: null });
              }),
            };
          }
          return {};
        }),
      };
      (createServerSupabaseClient as any).mockResolvedValue(mockSupabase);
      (createServiceClient as any).mockReturnValue(mockSupabase);

      const req = new NextRequest(`http://localhost:3000/api/slack/install?workspaceId=${workspaceId}`);
      const res = await installGet(req);
      expect(res.status).toBe(307);

      const redirectUrl = res.headers.get('location') || '';
      expect(redirectUrl).toContain('https://slack.com/oauth/v2/authorize');
      expect(redirectUrl).toContain('client_id=slack-client-id-123');
      expect(redirectUrl).toContain(`state=${insertedState.state_token}`);
      expect(insertedState.workspace_id).toBe(workspaceId);
      expect(insertedState.initiated_by).toBe(adminUserId);
    });
  });

  describe('Direct Connection (POST /api/slack/install)', () => {
    it('verifies bot token and idempotently registers installation and secrets', async () => {
      mockAuthTest.mockResolvedValue({
        ok: true,
        team_id: 'T0C9MTFPR43',
        team: 'Test Slack Team',
        user_id: 'U0C9TBD4T8T',
      });

      let installationUpsert: any = null;
      let secretUpsert: any = null;

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
          if (table === 'slack_installations') {
            return {
              upsert: vi.fn().mockImplementation((payload) => {
                installationUpsert = payload;
                return {
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: { id: 'inst-123', ...payload },
                      error: null,
                    }),
                  }),
                };
              }),
            };
          }
          if (table === 'slack_installation_secrets') {
            return {
              upsert: vi.fn().mockImplementation((payload) => {
                secretUpsert = payload;
                return Promise.resolve({ error: null });
              }),
            };
          }
          if (table === 'slack_user_mappings' || table === 'activity_events') {
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

      const req = new NextRequest('http://localhost:3000/api/slack/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          teamId: 'T0C9MTFPR43',
          botToken: 'xoxb-mock-token-123',
        }),
      });

      const res = await installPost(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(installationUpsert.slack_team_id).toBe('T0C9MTFPR43');
      expect(installationUpsert.installation_status).toBe('active');
      expect(secretUpsert.bot_token).toBe('xoxb-mock-token-123');
      expect(secretUpsert.installation_id).toBe('inst-123');
    });

    it('rejects invalid Slack bot token with 400', async () => {
      mockAuthTest.mockResolvedValue({
        ok: false,
        error: 'invalid_auth',
      });

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
          return {};
        }),
      };
      (createServerSupabaseClient as any).mockResolvedValue(mockSupabase);
      (createServiceClient as any).mockReturnValue(mockSupabase);

      const req = new NextRequest('http://localhost:3000/api/slack/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          teamId: 'T0C9MTFPR43',
          botToken: 'xoxb-bad-token',
        }),
      });

      const res = await installPost(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Slack auth verification failed: invalid_auth');
    });
  });

  describe('OAuth Callback Handling (GET /api/slack/callback)', () => {
    it('redirects with error parameter if Slack reports oauth cancellation or error', async () => {
      const req = new NextRequest('http://localhost:3000/api/slack/callback?error=access_denied');
      const res = await callbackGet(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('slack_error=access_denied');
    });

    it('redirects with error if code or state is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/slack/callback?code=some_code');
      const res = await callbackGet(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('slack_error=missing_code_or_state');
    });

    it('rejects invalid or expired state token', async () => {
      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: adminUserId } } }) },
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          gt: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      };
      (createServerSupabaseClient as any).mockResolvedValue(mockSupabase);
      (createServiceClient as any).mockReturnValue(mockSupabase);

      const req = new NextRequest('http://localhost:3000/api/slack/callback?code=code123&state=tampered_state');
      const res = await callbackGet(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('slack_error=invalid_or_expired_state');
    });

    it('successfully processes OAuth callback, stores tokens in secrets, and auto-maps members', async () => {
      const validState = 'valid-csrf-token-123';
      const mockStateRow = {
        id: 'state-row-1',
        state_token: validState,
        workspace_id: workspaceId,
        initiated_by: adminUserId,
      };

      let stateConsumed = false;
      let installationPersisted: any = null;
      let secretPersisted: any = null;
      const userMappingsPersisted: any[] = [];

      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: adminUserId } } }) },
        from: vi.fn((table: string) => {
          if (table === 'slack_oauth_states') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              is: vi.fn().mockReturnThis(),
              gt: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: mockStateRow, error: null }),
              update: vi.fn().mockImplementation(() => {
                stateConsumed = true;
                return { eq: vi.fn().mockResolvedValue({ error: null }) };
              }),
            };
          }
          if (table === 'workspace_members') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockImplementation((col: string, val: string) => {
                if (col === 'workspace_id' && val === workspaceId) {
                  return {
                    eq: vi.fn().mockReturnValue({
                      maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'admin' } }),
                    }),
                    // For auto-mapping list of members
                    then: (resolve: any) =>
                      resolve({
                        data: [
                          {
                            user_id: memberUserId,
                            profiles: { id: memberUserId, email: 'member@company.com', display_name: 'Member User' },
                          },
                        ],
                      }),
                  };
                }
                return {};
              }),
              maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'admin' } }),
            };
          }
          if (table === 'slack_installations') {
            return {
              upsert: vi.fn().mockImplementation((payload) => {
                installationPersisted = payload;
                return {
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: { id: 'inst-999', ...payload },
                      error: null,
                    }),
                  }),
                };
              }),
            };
          }
          if (table === 'slack_installation_secrets') {
            return {
              upsert: vi.fn().mockImplementation((payload) => {
                secretPersisted = payload;
                return Promise.resolve({ error: null });
              }),
            };
          }
          if (table === 'slack_user_mappings') {
            return {
              upsert: vi.fn().mockImplementation((payload) => {
                userMappingsPersisted.push(payload);
                return Promise.resolve({ error: null });
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

      // Mock fetch for Slack oauth.v2.access
      global.fetch = vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          ok: true,
          access_token: 'xoxb-new-bot-token-999',
          team: { id: 'T0C9MTFPR43', name: 'Acme Slack' },
          bot_user_id: 'U0C9TBD4T8T',
          authed_user: { id: 'U0C9NRMSXUM' },
        }),
      } as any);

      mockUsersInfo.mockResolvedValue({
        ok: true,
        user: {
          id: 'U0C9NRMSXUM',
          name: 'admin.slack',
          real_name: 'Admin Slack',
          profile: { email: 'admin@company.com' },
        },
      });

      mockUsersList.mockResolvedValue({
        ok: true,
        members: [
          {
            id: 'U_MEMBER_SLACK',
            name: 'member.slack',
            real_name: 'Member Slack',
            is_bot: false,
            profile: { email: 'member@company.com' },
          },
        ],
      });

      const req = new NextRequest(`http://localhost:3000/api/slack/callback?code=good_code&state=${validState}`);
      const res = await callbackGet(req);

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain(`slack_success=installed`);
      expect(stateConsumed).toBe(true);
      expect(installationPersisted.slack_team_id).toBe('T0C9MTFPR43');
      expect(installationPersisted.installation_status).toBe('active');
      expect(secretPersisted.bot_token).toBe('xoxb-new-bot-token-999');
      expect(secretPersisted.installation_id).toBe('inst-999');

      // Check installer mapped
      const installerMapping = userMappingsPersisted.find((m) => m.slack_user_id === 'U0C9NRMSXUM');
      expect(installerMapping).toBeDefined();
      expect(installerMapping.taskpilot_user_id).toBe(adminUserId);

      // Check workspace member auto-mapped by email
      const memberMapping = userMappingsPersisted.find((m) => m.slack_user_id === 'U_MEMBER_SLACK');
      expect(memberMapping).toBeDefined();
      expect(memberMapping.taskpilot_user_id).toBe(memberUserId);
    });
  });
});
