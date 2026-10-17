import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
  hasServiceRoleKey: vi.fn(() => true),
}));

import { POST as linkPost, GET as linkGet } from '@/app/api/slack/link/route';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServiceClient, hasServiceRoleKey } from '@/lib/supabase/service';

describe('Slack Identity Linking Flow', () => {
  const workspaceId = '00000000-0000-0000-0000-000000000001';
  const memberUserId = 'user-member-123';

  beforeEach(() => {
    vi.clearAllMocks();
    (hasServiceRoleKey as any).mockReturnValue(true);
  });

  describe('Generate Link Challenge (POST /api/slack/link)', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      };
      (createServerSupabaseClient as any).mockResolvedValue(mockSupabase);

      const req = new NextRequest('http://localhost:3000/api/slack/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });

      const res = await linkPost(req);
      expect(res.status).toBe(401);
    });

    it('rejects non-members of the workspace with 403', async () => {
      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: memberUserId } } }) },
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        })),
      };
      (createServerSupabaseClient as any).mockResolvedValue(mockSupabase);

      const req = new NextRequest('http://localhost:3000/api/slack/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });

      const res = await linkPost(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('not a member');
    });

    it('returns existing mapping info if account is already linked', async () => {
      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: memberUserId } } }) },
        from: vi.fn((table: string) => {
          if (table === 'workspace_members') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'member' } }),
            };
          }
          if (table === 'slack_user_mappings') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: 'mapping-1',
                  slack_user_id: 'U0C9NRMSXUM',
                  slack_username: 'omkar',
                },
              }),
            };
          }
          return {};
        }),
      };
      (createServerSupabaseClient as any).mockResolvedValue(mockSupabase);
      (createServiceClient as any).mockReturnValue(mockSupabase);

      const req = new NextRequest('http://localhost:3000/api/slack/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });

      const res = await linkPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.alreadyLinked).toBe(true);
      expect(data.slackUserId).toBe('U0C9NRMSXUM');
    });

    it('generates a new 6-digit challenge code and invalidates previous pending challenges', async () => {
      let insertedChallenge: any = null;
      let invalidatedOld = false;

      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: memberUserId } } }) },
        from: vi.fn((table: string) => {
          if (table === 'workspace_members') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'member' } }),
            };
          }
          if (table === 'slack_user_mappings') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            };
          }
          if (table === 'slack_link_challenges') {
            return {
              update: vi.fn().mockImplementation(() => {
                invalidatedOld = true;
                return {
                  eq: vi.fn().mockReturnThis(),
                  is: vi.fn().mockResolvedValue({ error: null }),
                };
              }),
              insert: vi.fn().mockImplementation((payload) => {
                insertedChallenge = payload;
                return Promise.resolve({ error: null });
              }),
            };
          }
          return {};
        }),
      };
      (createServerSupabaseClient as any).mockResolvedValue(mockSupabase);
      (createServiceClient as any).mockReturnValue(mockSupabase);

      const req = new NextRequest('http://localhost:3000/api/slack/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });

      const res = await linkPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.challengeCode).toBeDefined();
      expect(data.challengeCode).toMatch(/^TP-\d{4}$/);
      expect(invalidatedOld).toBe(true);
      expect(insertedChallenge.workspace_id).toBe(workspaceId);
      expect(insertedChallenge.user_id).toBe(memberUserId);
      expect(data.instruction).toContain(data.challengeCode);
    });
  });

  describe('Query Link Status (GET /api/slack/link)', () => {
    it('returns isLinked: false when mapping does not exist', async () => {
      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: memberUserId } } }) },
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        })),
      };
      (createServerSupabaseClient as any).mockResolvedValue(mockSupabase);
      (createServiceClient as any).mockReturnValue(mockSupabase);

      const req = new NextRequest(`http://localhost:3000/api/slack/link?workspaceId=${workspaceId}`);
      const res = await linkGet(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.isLinked).toBe(false);
      expect(data.mapping).toBeNull();
    });

    it('returns isLinked: true and mapping details when mapping exists', async () => {
      const mockMapping = {
        id: 'map-123',
        workspace_id: workspaceId,
        slack_user_id: 'U0C9NRMSXUM',
        slack_username: 'omkar',
        taskpilot_user_id: memberUserId,
        link_status: 'linked',
      };

      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: memberUserId } } }) },
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: mockMapping }),
        })),
      };
      (createServerSupabaseClient as any).mockResolvedValue(mockSupabase);
      (createServiceClient as any).mockReturnValue(mockSupabase);

      const req = new NextRequest(`http://localhost:3000/api/slack/link?workspaceId=${workspaceId}`);
      const res = await linkGet(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.isLinked).toBe(true);
      expect(data.mapping.slack_user_id).toBe('U0C9NRMSXUM');
    });
  });
});
