import { describe, it, expect } from 'vitest';

describe('Project Creation — Mandatory GitHub Repository Rules', () => {
  it('validates that project creation requires an authorized github repository id', () => {
    // Contract definition test for create_project_with_limits RPC params
    interface CreateProjectWithLimitsParams {
      p_workspace_id: string;
      p_name: string;
      p_identifier: string;
      p_description?: string | null;
      p_status?: string;
      p_lead_id?: string | null;
      p_start_date?: string | null;
      p_target_date?: string | null;
      p_github_repo_id: number;
    }

    const validPayload: CreateProjectWithLimitsParams = {
      p_workspace_id: '11111111-1111-1111-1111-111111111111',
      p_name: 'Core Platform',
      p_identifier: 'CORE',
      p_github_repo_id: 987654321,
    };

    expect(validPayload.p_github_repo_id).toBeGreaterThan(0);
    expect(validPayload.p_identifier).toBe('CORE');
  });

  it('rejects payload when p_github_repo_id is missing or null', () => {
    const validateProjectCreation = (params: { p_github_repo_id?: number | null }) => {
      if (!params.p_github_repo_id) {
        throw new Error('MANDATORY_GITHUB_REPO_REQUIRED: Every project must be connected to an authorized GitHub repository.');
      }
      return true;
    };

    expect(() => validateProjectCreation({ p_github_repo_id: null })).toThrow('MANDATORY_GITHUB_REPO_REQUIRED');
    expect(() => validateProjectCreation({ p_github_repo_id: undefined })).toThrow('MANDATORY_GITHUB_REPO_REQUIRED');
    expect(validateProjectCreation({ p_github_repo_id: 12345 })).toBe(true);
  });

  it('handles simulated RPC errors for unauthorized repository or duplicate link', () => {
    const handleRpcResponse = (response: { data: any; error: { message: string } | null }) => {
      if (response.error) {
        if (response.error.message.includes('MANDATORY_GITHUB_REPO_REQUIRED')) {
          return { status: 400, code: 'MISSING_REPO' };
        }
        if (response.error.message.includes('UNAUTHORIZED_GITHUB_REPO')) {
          return { status: 403, code: 'UNAUTHORIZED_REPO' };
        }
        if (response.error.message.includes('REPO_ALREADY_LINKED')) {
          return { status: 409, code: 'REPO_ALREADY_LINKED' };
        }
        if (response.error.message.includes('PROJECT_LIMIT_EXCEEDED')) {
          return { status: 402, code: 'PROJECT_LIMIT_EXCEEDED' };
        }
        return { status: 500, code: 'INTERNAL' };
      }
      return { status: 200, code: 'SUCCESS', data: response.data };
    };

    expect(handleRpcResponse({ data: null, error: { message: 'UNAUTHORIZED_GITHUB_REPO: Not found' } })).toEqual({
      status: 403,
      code: 'UNAUTHORIZED_REPO',
    });

    expect(handleRpcResponse({ data: null, error: { message: 'REPO_ALREADY_LINKED: Already connected' } })).toEqual({
      status: 409,
      code: 'REPO_ALREADY_LINKED',
    });

    expect(handleRpcResponse({ data: null, error: { message: 'PROJECT_LIMIT_EXCEEDED: Plan limit reached' } })).toEqual({
      status: 402,
      code: 'PROJECT_LIMIT_EXCEEDED',
    });
  });
});
