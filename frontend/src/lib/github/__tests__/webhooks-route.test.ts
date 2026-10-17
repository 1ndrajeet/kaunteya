import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
  hasServiceRoleKey: vi.fn(() => true),
}));

vi.mock('@/lib/evidence/matcher', () => ({
  matchArtifactsToWorkspaceClaims: vi.fn().mockResolvedValue(0),
}));

import { POST } from '@/app/api/github/webhooks/route';
import { createServiceClient, hasServiceRoleKey } from '@/lib/supabase/service';

describe('GitHub Webhooks Route (POST /api/github/webhooks)', () => {
  const secret = 'webhook-test-secret-12345';

  function signPayload(body: string, sec: string = secret): string {
    const hex = crypto.createHmac('sha256', sec).update(body, 'utf8').digest('hex');
    return `sha256=${hex}`;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GITHUB_WEBHOOK_SECRET = secret;
    (hasServiceRoleKey as any).mockReturnValue(true);
  });

  it('fails closed with 500 when GITHUB_WEBHOOK_SECRET is not configured', async () => {
    delete process.env.GITHUB_WEBHOOK_SECRET;

    const payload = JSON.stringify({ action: 'ping' });
    const req = new NextRequest('http://localhost:3000/api/github/webhooks', {
      method: 'POST',
      headers: {
        'x-github-delivery': 'del-1',
        'x-github-event': 'ping',
        'x-hub-signature-256': signPayload(payload),
      },
      body: payload,
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.code).toBe('CONFIG_ERROR');
  });

  it('rejects invalid signature with 401', async () => {
    const payload = JSON.stringify({ action: 'ping' });
    const req = new NextRequest('http://localhost:3000/api/github/webhooks', {
      method: 'POST',
      headers: {
        'x-github-delivery': 'del-1',
        'x-github-event': 'ping',
        'x-hub-signature-256': signPayload(payload, 'wrong-secret'),
      },
      body: payload,
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns retryable 500 if event journaling fails for any reason other than duplicate', async () => {
    const payload = JSON.stringify({ action: 'ping' });
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'github_events') {
          return {
            insert: vi.fn().mockResolvedValue({
              error: { code: '42501', message: 'permission denied for table github_events' },
            }),
          };
        }
        return {};
      }),
    };
    (createServiceClient as any).mockReturnValue(mockSupabase);

    const req = new NextRequest('http://localhost:3000/api/github/webhooks', {
      method: 'POST',
      headers: {
        'x-github-delivery': 'del-1',
        'x-github-event': 'ping',
        'x-hub-signature-256': signPayload(payload),
      },
      body: payload,
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.code).toBe('JOURNAL_FAILED');
  });

  it('handles duplicate delivery ID as idempotent success', async () => {
    const payload = JSON.stringify({ action: 'ping' });
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'github_events') {
          return {
            insert: vi.fn().mockResolvedValue({
              error: { code: '23505', message: 'duplicate key value violates unique constraint' },
            }),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { processing_status: 'processed' },
            }),
          };
        }
        return {};
      }),
    };
    (createServiceClient as any).mockReturnValue(mockSupabase);

    const req = new NextRequest('http://localhost:3000/api/github/webhooks', {
      method: 'POST',
      headers: {
        'x-github-delivery': 'duplicate-del-1',
        'x-github-event': 'ping',
        'x-hub-signature-256': signPayload(payload),
      },
      body: payload,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.duplicate).toBe(true);
    expect(data.status).toBe('processed');
  });

  it('processes ping event successfully and updates delivery to processed', async () => {
    const payload = JSON.stringify({ zen: 'Keep it logically awesome.' });
    const updateSpy = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'github_events') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
            update: updateSpy,
          };
        }
        return {};
      }),
    };
    (createServiceClient as any).mockReturnValue(mockSupabase);

    const req = new NextRequest('http://localhost:3000/api/github/webhooks', {
      method: 'POST',
      headers: {
        'x-github-delivery': 'ping-del-1',
        'x-github-event': 'ping',
        'x-hub-signature-256': signPayload(payload),
      },
      body: payload,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.pong).toBe(true);
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ processing_status: 'processed' })
    );
  });

  it('handles installation deleted event by revoking installation status and disabling repositories', async () => {
    const payload = JSON.stringify({
      action: 'deleted',
      installation: { id: 777123 },
    });

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'github_events') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
            update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
          };
        }
        if (table === 'github_installations') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'inst-row-1' } }),
                }),
              }),
            }),
          };
        }
        if (table === 'github_repositories') {
          return {
            update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
          };
        }
        return {};
      }),
    };
    (createServiceClient as any).mockReturnValue(mockSupabase);

    const req = new NextRequest('http://localhost:3000/api/github/webhooks', {
      method: 'POST',
      headers: {
        'x-github-delivery': 'inst-del-1',
        'x-github-event': 'installation',
        'x-hub-signature-256': signPayload(payload),
      },
      body: payload,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.processed).toBe('installation');
    expect(data.action).toBe('deleted');
  });

  it('ingests pull_request event by matching task identifier and saving evidence_artifact', async () => {
    const payload = JSON.stringify({
      action: 'opened',
      repository: { id: 888999, full_name: 'acme/core' },
      pull_request: {
        number: 42,
        title: 'feat: implement CORE-14 user auth',
        html_url: 'https://github.com/acme/core/pull/42',
        state: 'open',
        user: { login: 'alice', id: 501 },
        head: { ref: 'feat/core-14-auth', sha: 'sha12345' },
        base: { ref: 'main' },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });

    const artifactUpsertSpy = vi.fn().mockResolvedValue({ error: null });

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'github_events') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
            update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
          };
        }
        if (table === 'github_repositories') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: 'repo-uuid-1',
                workspace_id: 'ws-uuid-1',
                is_enabled: true,
              },
            }),
          };
        }
        if (table === 'tasks') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: 'task-uuid-14', task_number: 14, project: { identifier: 'CORE' } },
              ],
            }),
          };
        }
        if (table === 'evidence_artifacts') {
          return {
            upsert: artifactUpsertSpy,
          };
        }
        return {};
      }),
    };
    (createServiceClient as any).mockReturnValue(mockSupabase);

    const req = new NextRequest('http://localhost:3000/api/github/webhooks', {
      method: 'POST',
      headers: {
        'x-github-delivery': 'pr-del-1',
        'x-github-event': 'pull_request',
        'x-hub-signature-256': signPayload(payload),
      },
      body: payload,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.processed).toBe('pull_request');

    expect(artifactUpsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        external_id: '42',
        matched_task_identifier: 'CORE-14',
        task_id: 'task-uuid-14',
      }),
      expect.any(Object)
    );
  });
});
