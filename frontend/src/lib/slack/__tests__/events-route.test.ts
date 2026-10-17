import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
  hasServiceRoleKey: vi.fn(() => true),
}));

const mockPostMessage = vi.fn().mockResolvedValue({ ok: true, ts: '1234.5678' });
const mockUsersInfo = vi.fn();

vi.mock('@slack/web-api', () => {
  class MockWebClient {
    chat = { postMessage: mockPostMessage };
    users = { info: mockUsersInfo };
    auth = { test: vi.fn().mockResolvedValue({ ok: false }) };
  }
  return { WebClient: MockWebClient };
});

vi.mock('@/lib/routing/agent-router', () => ({
  evaluateAgentAssistedRouting: vi.fn().mockResolvedValue({
    decision: {
      action: 'assign_directly',
      assigneeUserId: 'user-member-1',
      assigneeDisplayName: 'Member One',
      ruleCode: 'EXPLICIT_ASSIGNEE',
      explanation: 'Explicitly requested',
      requiresLeadTriage: false,
    },
  }),
  persistRoutingDecision: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from '@/app/api/slack/events/route';
import { createServiceClient } from '@/lib/supabase/service';

describe('Slack Events Route (POST /api/slack/events)', () => {
  const signingSecret = 'test-signing-secret-slack-999';
  const workspaceId = '00000000-0000-0000-0000-000000000001';
  const teamId = 'T0C9MTFPR43';
  const botUserId = 'U0C9TBD4T8T';
  const slackUserId = 'U0C9NRMSXUM';
  const taskpilotUserId = 'user-omkar-123';

  function createSignedRequest(bodyObj: any, secret: string = signingSecret, customTimestamp?: number) {
    const rawBody = JSON.stringify(bodyObj);
    const timestamp = customTimestamp ?? Math.floor(Date.now() / 1000);
    const basestring = `v0:${timestamp}:${rawBody}`;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(basestring, 'utf8');
    const signature = `v0=${hmac.digest('hex')}`;

    return new NextRequest('http://localhost:3000/api/slack/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-slack-signature': signature,
        'x-slack-request-timestamp': timestamp.toString(),
      },
      body: rawBody,
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SLACK_SIGNING_SECRET = signingSecret;
    process.env.SLACK_BOT_TOKEN = 'xoxb-fallback-token-test';
  });

  describe('Slack URL Verification Challenge', () => {
    it('returns the challenge when signed correctly', async () => {
      const challengeReq = createSignedRequest({
        type: 'url_verification',
        challenge: 'slack_challenge_token_456',
      });

      const res = await POST(challengeReq);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.challenge).toBe('slack_challenge_token_456');
    });

    it('rejects URL verification with invalid signature with 401', async () => {
      const challengeReq = createSignedRequest(
        {
          type: 'url_verification',
          challenge: 'slack_challenge_token_456',
        },
        'wrong-signing-secret'
      );

      const res = await POST(challengeReq);
      expect(res.status).toBe(401);
    });
  });

  describe('Bot Message Filtering & Deduplication', () => {
    it('ignores bot messages without processing', async () => {
      const botReq = createSignedRequest({
        team_id: teamId,
        event: {
          type: 'message',
          bot_id: 'B123456',
          text: 'I am a bot notification',
          channel: 'D123',
        },
      });

      const res = await POST(botReq);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ignored).toBe('bot_message');
    });

    it('returns duplicate: true when event has already been registered in integration_events', async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'integration_events') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'evt-1', processing_status: 'processed' },
              }),
            };
          }
          return {};
        }),
      };
      (createServiceClient as any).mockReturnValue(mockSupabase);

      const req = createSignedRequest({
        event_id: 'evt_duplicate_123',
        team_id: teamId,
        event: {
          type: 'message',
          user: slackUserId,
          text: 'hello world',
          channel: 'D123',
          ts: '12345.678',
        },
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.duplicate).toBe(true);
      expect(data.status).toBe('processed');
    });
  });

  describe('Missing Installation Handling', () => {
    it('marks integration_event as ignored when no active installation is found', async () => {
      let updatedEvent: any = null;

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'integration_events') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              insert: vi.fn().mockResolvedValue({ error: null }),
              update: vi.fn().mockImplementation((payload) => {
                updatedEvent = payload;
                return {
                  eq: vi.fn().mockReturnThis(),
                };
              }),
            };
          }
          if (table === 'slack_installations') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            };
          }
          return {};
        }),
      };
      (createServiceClient as any).mockReturnValue(mockSupabase);

      // Disable fallback bot token so no auto-heal happens
      delete process.env.SLACK_BOT_TOKEN;

      const req = createSignedRequest({
        event_id: 'evt_no_inst_1',
        team_id: 'T_UNKNOWN_TEAM',
        event: {
          type: 'message',
          user: slackUserId,
          text: 'hi',
          channel: 'D123',
          ts: '12345.678',
        },
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ignored).toBe('no_active_installation');
      expect(updatedEvent.processing_status).toBe('ignored');
      expect(updatedEvent.error_summary).toContain('No active installation found for Slack Team ID T_UNKNOWN_TEAM');
    });
  });

  describe('Unmapped Slack User Handling', () => {
    it('sends unlinked user instructions and marks event ignored when sender is not mapped', async () => {
      let updatedEvent: any = null;

      const mockInstallation = {
        id: 'inst-1',
        workspace_id: workspaceId,
        slack_team_id: teamId,
        installation_status: 'active',
      };

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'integration_events') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              insert: vi.fn().mockResolvedValue({ error: null }),
              update: vi.fn().mockImplementation((payload) => {
                updatedEvent = payload;
                return { eq: vi.fn().mockReturnThis() };
              }),
            };
          }
          if (table === 'slack_installations') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: mockInstallation }),
              then: (resolve: any) => resolve({ data: [mockInstallation] }),
            };
          }
          if (table === 'slack_installation_secrets') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: { bot_token: 'xoxb-inst-token' } }),
            };
          }
          if (table === 'slack_user_mappings') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              then: (resolve: any) => resolve({ data: [] }),
            };
          }
          if (table === 'workspace_members') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({ data: [] }),
              then: (resolve: any) => resolve({ data: [] }),
            };
          }
          return {};
        }),
      };
      (createServiceClient as any).mockReturnValue(mockSupabase);

      // Slack API users.info returns user with no matching workspace email
      mockUsersInfo.mockResolvedValue({
        ok: true,
        user: { id: 'U_STRANGER', profile: { email: 'stranger@unknown.com' } },
      });

      const req = createSignedRequest({
        event_id: 'evt_unmapped_1',
        team_id: teamId,
        event: {
          type: 'message',
          user: 'U_STRANGER',
          text: 'hi TaskPilot',
          channel: 'D123',
          ts: '12345.678',
        },
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ignored).toBe('unmapped_user');
      expect(mockPostMessage).toHaveBeenCalled(); // Unlinked notice sent
      expect(updatedEvent.error_code).toBe('UNMAPPED_SLACK_USER');
    });
  });

  describe('Secure Identity Challenge Linking', () => {
    it('links Slack user to TaskPilot account when user messages "link TP-1234"', async () => {
      const mockInstallation = {
        id: 'inst-1',
        workspace_id: workspaceId,
        slack_team_id: teamId,
        installation_status: 'active',
      };

      let challengeConsumed = false;
      let userMappingCreated: any = null;

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'integration_events') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              insert: vi.fn().mockResolvedValue({ error: null }),
              update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnThis() }),
            };
          }
          if (table === 'slack_installations') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: mockInstallation }),
            };
          }
          if (table === 'slack_installation_secrets') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: { bot_token: 'xoxb-inst-token' } }),
            };
          }
          if (table === 'slack_link_challenges') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              is: vi.fn().mockReturnThis(),
              gt: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: 'chal-123',
                  user_id: taskpilotUserId,
                  workspace_id: workspaceId,
                },
              }),
              update: vi.fn().mockImplementation(() => {
                challengeConsumed = true;
                return { eq: vi.fn().mockResolvedValue({ error: null }) };
              }),
            };
          }
          if (table === 'profiles') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { id: taskpilotUserId, display_name: 'Omkar Kulkarni', email: 'omkar@company.com' },
              }),
            };
          }
          if (table === 'slack_user_mappings') {
            return {
              upsert: vi.fn().mockImplementation((payload) => {
                userMappingCreated = payload;
                return Promise.resolve({ error: null });
              }),
            };
          }
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
      (createServiceClient as any).mockReturnValue(mockSupabase);

      const req = createSignedRequest({
        event_id: 'evt_link_1',
        team_id: teamId,
        event: {
          type: 'message',
          user: slackUserId,
          text: '@TaskPilot link TP-4921',
          channel: 'D123',
          ts: '12345.678',
        },
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.processed).toBe('identity_linked');
      expect(challengeConsumed).toBe(true);
      expect(userMappingCreated.slack_user_id).toBe(slackUserId);
      expect(userMappingCreated.taskpilot_user_id).toBe(taskpilotUserId);
      expect(userMappingCreated.link_status).toBe('linked');
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Identity Verified'),
        })
      );
    });
  });

  describe('Conversational Agent Reply with Active Tasks', () => {
    it('replies to greeting message with agent guidance and active tasks list', async () => {
      const mockInstallation = {
        id: 'inst-1',
        workspace_id: workspaceId,
        slack_team_id: teamId,
        installation_status: 'active',
      };

      const mockMapping = {
        id: 'map-1',
        workspace_id: workspaceId,
        installation_id: 'inst-1',
        taskpilot_user_id: taskpilotUserId,
        slack_user_id: slackUserId,
        link_status: 'linked',
        profiles: { id: taskpilotUserId, display_name: 'Omkar Kulkarni', email: 'omkar@company.com' },
      };

      const mockTasks = [
        {
          id: 'task-1',
          task_number: 14,
          title: 'Implement OAuth callback',
          status: 'In Progress',
          priority: 'High',
          project: { identifier: 'CORE', name: 'Core Engine' },
        },
      ];

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'integration_events') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              insert: vi.fn().mockResolvedValue({ error: null }),
              update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnThis() }),
            };
          }
          if (table === 'slack_installations') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: mockInstallation }),
              then: (resolve: any) => resolve({ data: [mockInstallation] }),
            };
          }
          if (table === 'slack_installation_secrets') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: { bot_token: 'xoxb-inst-token' } }),
            };
          }
          if (table === 'slack_user_mappings') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: mockMapping }),
              then: (resolve: any) => resolve({ data: [mockMapping] }),
            };
          }
          if (table === 'workspace_members') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'member' } }),
            };
          }
          if (table === 'external_messages') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              not: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            };
          }
          if (table === 'tasks') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              not: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({ data: mockTasks }),
            };
          }
          return {};
        }),
      };
      (createServiceClient as any).mockReturnValue(mockSupabase);

      const req = createSignedRequest({
        event_id: 'evt_chat_1',
        team_id: teamId,
        event: {
          type: 'message',
          user: slackUserId,
          text: 'hi TaskPilot',
          channel: 'D123',
          ts: '12345.678',
        },
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.processed).toBe('agent_guidance');

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'D123',
          text: expect.stringContaining('Hello *Omkar Kulkarni*'),
        })
      );
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('CORE-14'),
        })
      );
    });
  });

  describe('Task Status Update Intent', () => {
    it('updates status of referenced task when user messages "CORE-14 is Done"', async () => {
      const mockInstallation = {
        id: 'inst-1',
        workspace_id: workspaceId,
        slack_team_id: teamId,
        installation_status: 'active',
      };

      const mockMapping = {
        id: 'map-1',
        workspace_id: workspaceId,
        installation_id: 'inst-1',
        taskpilot_user_id: taskpilotUserId,
        slack_user_id: slackUserId,
        link_status: 'linked',
        profiles: { id: taskpilotUserId, display_name: 'Omkar Kulkarni', email: 'omkar@company.com' },
      };

      let updatedTaskStatus: string | null = null;

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'integration_events') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              insert: vi.fn().mockResolvedValue({ error: null }),
              update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnThis() }),
            };
          }
          if (table === 'slack_installations') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: mockInstallation }),
              then: (resolve: any) => resolve({ data: [mockInstallation] }),
            };
          }
          if (table === 'slack_installation_secrets') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: { bot_token: 'xoxb-inst-token' } }),
            };
          }
          if (table === 'slack_user_mappings') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: mockMapping }),
              then: (resolve: any) => resolve({ data: [mockMapping] }),
            };
          }
          if (table === 'workspace_members') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'member' } }),
            };
          }
          if (table === 'external_messages') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              not: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            };
          }
          if (table === 'tasks') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: 'task-14',
                  status: 'In Progress',
                  title: 'Slack integration',
                  task_number: 14,
                  project: { id: 'proj-1', identifier: 'CORE', name: 'Core Engine' },
                },
              }),
              update: vi.fn().mockImplementation((payload) => {
                updatedTaskStatus = payload.status;
                return { eq: vi.fn().mockResolvedValue({ error: null }) };
              }),
            };
          }
          if (table === 'activity_events') {
            return { insert: vi.fn().mockResolvedValue({ error: null }) };
          }
          return {};
        }),
      };
      (createServiceClient as any).mockReturnValue(mockSupabase);

      const req = createSignedRequest({
        event_id: 'evt_status_1',
        team_id: teamId,
        event: {
          type: 'message',
          user: slackUserId,
          text: 'CORE-14 is Done',
          channel: 'D123',
          ts: '12345.678',
        },
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.processed).toBe('status_updated');
      expect(updatedTaskStatus).toBe('Done');
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('CORE-14'),
        })
      );
    });
  });

  describe('Task Creation Intent & Agent Routing', () => {
    it('creates a task via agent routing when user messages "create a task to fix login button in project CORE"', async () => {
      const mockInstallation = {
        id: 'inst-1',
        workspace_id: workspaceId,
        slack_team_id: teamId,
        installation_status: 'active',
      };

      const mockMapping = {
        id: 'map-1',
        taskpilot_user_id: taskpilotUserId,
        link_status: 'linked',
        profiles: { id: taskpilotUserId, display_name: 'Omkar Kulkarni', email: 'omkar@company.com' },
      };

      let insertedTask: any = null;
      let insertedExternalMessage: any = null;

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'integration_events') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              insert: vi.fn().mockResolvedValue({ error: null }),
              update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnThis() }),
            };
          }
          if (table === 'slack_installations') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: mockInstallation }),
            };
          }
          if (table === 'slack_installation_secrets') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: { bot_token: 'xoxb-inst-token' } }),
            };
          }
          if (table === 'slack_user_mappings') {
            const chain: any = {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: mockMapping }),
              then: (resolve: any) =>
                resolve({
                  data: [{ taskpilot_user_id: taskpilotUserId, slack_user_id: slackUserId }],
                }),
            };
            return chain;
          }
          if (table === 'workspace_members') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockImplementation((col: string) => {
                if (col === 'workspace_id') {
                  return {
                    eq: vi.fn().mockReturnValue({
                      maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'lead' } }),
                    }),
                    then: (resolve: any) =>
                      resolve({
                        data: [
                          {
                            user_id: taskpilotUserId,
                            role: 'lead',
                            profiles: { id: taskpilotUserId, display_name: 'Omkar Kulkarni' },
                          },
                        ],
                      }),
                  };
                }
                return {};
              }),
              maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'lead' } }),
            };
          }
          if (table === 'external_messages') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              not: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              insert: vi.fn().mockImplementation((payload) => {
                insertedExternalMessage = payload;
                return Promise.resolve({ error: null });
              }),
            };
          }
          if (table === 'projects') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              then: (resolve: any) =>
                resolve({
                  data: [{ id: 'proj-1', identifier: 'CORE', name: 'Core Engine', status: 'active' }],
                }),
            };
          }
          if (table === 'tasks') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              in: vi.fn().mockResolvedValue({ data: [] }),
              insert: vi.fn().mockImplementation((payload) => {
                insertedTask = payload;
                return {
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: { id: 'task-created-1', title: payload.title, priority: payload.priority, status: payload.status },
                      error: null,
                    }),
                  }),
                };
              }),
            };
          }
          if (table === 'activity_events') {
            return { insert: vi.fn().mockResolvedValue({ error: null }) };
          }
          return {};
        }),
        rpc: vi.fn().mockResolvedValue({ data: 15 }),
      };
      (createServiceClient as any).mockReturnValue(mockSupabase);

      const req = createSignedRequest({
        event_id: 'evt_create_1',
        team_id: teamId,
        event: {
          type: 'message',
          user: slackUserId,
          text: 'create task fix login button in project CORE',
          channel: 'D123',
          ts: '12345.678',
        },
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.task_identifier).toBe('CORE-15');
      expect(insertedTask).toBeDefined();
      expect(insertedTask.project_id).toBe('proj-1');
      expect(insertedExternalMessage.external_conversation_id).toBe('D123');
      expect(mockPostMessage).toHaveBeenCalled();
    });
  });

  describe('Workspace Mismatch & Cross-Workspace Reconciliation', () => {
    it('reconciles Slack team into legitimate user workspace when team was previously associated with another workspace', async () => {
      const foreignWorkspaceId = '8c6f1835-f0ae-43fd-b318-707f4765efda';
      const legitimateWorkspaceId = '885aaa08-8a68-49e9-9d86-e52ee69f0137';

      // An installation exists for the foreign workspace
      const foreignInstallation = {
        id: 'inst-foreign-1',
        workspace_id: foreignWorkspaceId,
        slack_team_id: teamId,
        installation_status: 'active',
      };

      let reconciledWorkspaceId: string | null = null;
      let reconciledMapping: any = null;

      mockUsersInfo.mockResolvedValue({
        ok: true,
        user: {
          id: slackUserId,
          name: 'omkar',
          real_name: 'Omkar Kulkarni',
          profile: { email: 'omkar@company.com', real_name: 'Omkar Kulkarni' },
        },
      });

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'integration_events') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              insert: vi.fn().mockResolvedValue({ error: null }),
              update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnThis() }),
            };
          }
          if (table === 'slack_installations') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              then: (resolve: any) => resolve({ data: [foreignInstallation] }),
              upsert: vi.fn().mockImplementation((payload) => {
                reconciledWorkspaceId = payload.workspace_id;
                return {
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: {
                        id: 'inst-reconciled-1',
                        workspace_id: payload.workspace_id,
                        slack_team_id: payload.slack_team_id,
                        installation_status: 'active',
                      },
                      error: null,
                    }),
                  }),
                };
              }),
            };
          }
          if (table === 'slack_installation_secrets') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: { bot_token: 'xoxb-inst-token' } }),
              upsert: vi.fn().mockResolvedValue({ error: null }),
            };
          }
          if (table === 'slack_user_mappings') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              then: (resolve: any) => resolve({ data: [] }),
              upsert: vi.fn().mockImplementation((payload) => {
                reconciledMapping = payload;
                return {
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: {
                        id: 'map-new-1',
                        taskpilot_user_id: payload.taskpilot_user_id,
                        link_status: 'linked',
                        profiles: { id: payload.taskpilot_user_id, display_name: 'Omkar Kulkarni', email: 'omkar@company.com' },
                      },
                      error: null,
                    }),
                  }),
                };
              }),
            };
          }
          if (table === 'workspace_members') {
            const memberChain: any = {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockImplementation((col: string, val: string) => {
                // Sender email lookup across workspaces
                if (col === 'profiles.email') {
                  return Promise.resolve({
                    data: [
                      {
                        workspace_id: legitimateWorkspaceId,
                        role: 'admin',
                        user_id: taskpilotUserId,
                        profiles: { id: taskpilotUserId, email: 'omkar@company.com', display_name: 'Omkar Kulkarni' },
                      },
                    ],
                  });
                }
                // Check if user is in foreign workspace: returns empty
                if (col === 'workspace_id' && val === foreignWorkspaceId) {
                  const emptyChain: any = {
                    eq: vi.fn().mockReturnThis(),
                    then: (resolve: any) => resolve({ data: [] }),
                    maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                  };
                  return emptyChain;
                }
                return memberChain;
              }),
              maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'admin' } }),
              then: (resolve: any) =>
                resolve({
                  data: [
                    {
                      user_id: taskpilotUserId,
                      role: 'admin',
                      profiles: { id: taskpilotUserId, email: 'omkar@company.com', display_name: 'Omkar Kulkarni' },
                    },
                  ],
                }),
            };
            return memberChain;
          }
          if (table === 'external_messages') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              not: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            };
          }
          if (table === 'tasks') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              not: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({ data: [] }),
            };
          }
          return {};
        }),
      };
      (createServiceClient as any).mockReturnValue(mockSupabase);

      const req = createSignedRequest({
        event_id: 'evt_reconcile_1',
        team_id: teamId,
        event: {
          type: 'message',
          user: slackUserId,
          text: 'hello TaskPilot',
          channel: 'D123',
          ts: '12345.678',
        },
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.processed).toBe('agent_guidance');

      // Verified legitimate workspace was used, NOT foreign workspace
      expect(reconciledWorkspaceId).toBe(legitimateWorkspaceId);
      expect(reconciledMapping.workspace_id).toBe(legitimateWorkspaceId);
      expect(reconciledMapping.taskpilot_user_id).toBe(taskpilotUserId);
    });
  });

  describe('Cross-Workspace Isolation Enforcement', () => {
    it('rejects modifying a task from a different workspace even with valid identifier', async () => {
      const mockInstallation = {
        id: 'inst-1',
        workspace_id: workspaceId,
        slack_team_id: teamId,
        installation_status: 'active',
      };

      const mockMapping = {
        id: 'map-1',
        workspace_id: workspaceId,
        installation_id: 'inst-1',
        taskpilot_user_id: taskpilotUserId,
        slack_user_id: slackUserId,
        link_status: 'linked',
        profiles: { id: taskpilotUserId, display_name: 'Omkar Kulkarni', email: 'omkar@company.com' },
      };

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'integration_events') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              insert: vi.fn().mockResolvedValue({ error: null }),
              update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnThis() }),
            };
          }
          if (table === 'slack_installations') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: mockInstallation }),
              then: (resolve: any) => resolve({ data: [mockInstallation] }),
            };
          }
          if (table === 'slack_installation_secrets') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: { bot_token: 'xoxb-inst-token' } }),
            };
          }
          if (table === 'slack_user_mappings') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: mockMapping }),
              then: (resolve: any) => resolve({ data: [mockMapping] }),
            };
          }
          if (table === 'workspace_members') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'member' } }),
            };
          }
          if (table === 'tasks') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              // Task query filtered by installation workspace_id returns null because task belongs to foreign workspace
              maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              update: vi.fn(),
            };
          }
          return {};
        }),
      };
      (createServiceClient as any).mockReturnValue(mockSupabase);

      const req = createSignedRequest({
        event_id: 'evt_foreign_task_1',
        team_id: teamId,
        event: {
          type: 'message',
          user: slackUserId,
          text: 'PROJ-99 is Done',
          channel: 'D123',
          ts: '12345.678',
        },
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ignored).toBe('task_not_found');
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Could not find task *PROJ-99* in this workspace'),
        })
      );
    });
  });
});
