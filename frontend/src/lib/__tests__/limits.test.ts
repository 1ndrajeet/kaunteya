import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getMaxWorkspacesPerUser,
  getMaxProjectsPerWorkspace,
  getLimitsConfig,
} from '../limits';

describe('Server-Side Plan & Resource Limits Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.TASKPILOT_MAX_WORKSPACES_PER_USER;
    delete process.env.TASKPILOT_MAX_PROJECTS_PER_WORKSPACE;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Default Fallbacks', () => {
    it('returns default 1 workspace per user when env var is not set', () => {
      expect(getMaxWorkspacesPerUser()).toBe(1);
    });

    it('returns default 5 projects per workspace when env var is not set', () => {
      expect(getMaxProjectsPerWorkspace()).toBe(5);
    });

    it('returns default config object when no env vars are defined', () => {
      const config = getLimitsConfig();
      expect(config).toEqual({
        maxWorkspacesPerUser: 1,
        maxProjectsPerWorkspace: 5,
      });
    });
  });

  describe('Custom Environment Overrides', () => {
    it('correctly parses positive integers from environment variables', () => {
      process.env.TASKPILOT_MAX_WORKSPACES_PER_USER = '3';
      process.env.TASKPILOT_MAX_PROJECTS_PER_WORKSPACE = '10';

      const config = getLimitsConfig();
      expect(config.maxWorkspacesPerUser).toBe(3);
      expect(config.maxProjectsPerWorkspace).toBe(10);
    });

    it('falls back to defaults if environment variables contain invalid strings', () => {
      process.env.TASKPILOT_MAX_WORKSPACES_PER_USER = 'invalid-number';
      process.env.TASKPILOT_MAX_PROJECTS_PER_WORKSPACE = 'NaN';

      const config = getLimitsConfig();
      expect(config.maxWorkspacesPerUser).toBe(1);
      expect(config.maxProjectsPerWorkspace).toBe(5);
    });

    it('falls back to defaults if environment variables are negative or zero', () => {
      process.env.TASKPILOT_MAX_WORKSPACES_PER_USER = '0';
      process.env.TASKPILOT_MAX_PROJECTS_PER_WORKSPACE = '-4';

      const config = getLimitsConfig();
      expect(config.maxWorkspacesPerUser).toBe(1);
      expect(config.maxProjectsPerWorkspace).toBe(5);
    });
  });
});
