/**
 * TaskPilot — Server-Side Plan & Resource Limits Configuration
 *
 * Configures and validates workspace and project resource limits from environment
 * variables with safe fallbacks according to the TaskPilot commercial tiers.
 */

export interface LimitsConfig {
  maxWorkspacesPerUser: number;
  maxProjectsPerWorkspace: number;
}

const DEFAULT_MAX_WORKSPACES_PER_USER = 1;
const DEFAULT_MAX_PROJECTS_PER_WORKSPACE = 5;

/**
 * Parses and validates an integer environment variable.
 * Returns default if undefined, empty, or not a positive integer.
 */
function parsePositiveInteger(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value.trim(), 10);
  if (isNaN(parsed) || parsed < 1) {
    return defaultValue;
  }
  return parsed;
}

/**
 * Returns the maximum workspaces a user can create on the default plan.
 */
export function getMaxWorkspacesPerUser(): number {
  return parsePositiveInteger(
    process.env.TASKPILOT_MAX_WORKSPACES_PER_USER,
    DEFAULT_MAX_WORKSPACES_PER_USER
  );
}

/**
 * Returns the maximum projects allowed per workspace on the default plan.
 */
export function getMaxProjectsPerWorkspace(): number {
  return parsePositiveInteger(
    process.env.TASKPILOT_MAX_PROJECTS_PER_WORKSPACE,
    DEFAULT_MAX_PROJECTS_PER_WORKSPACE
  );
}

/**
 * Validates and returns the active server-side limits configuration.
 */
export function getLimitsConfig(): LimitsConfig {
  return {
    maxWorkspacesPerUser: getMaxWorkspacesPerUser(),
    maxProjectsPerWorkspace: getMaxProjectsPerWorkspace(),
  };
}

export interface UserEntitlementCheck {
  hasActiveEntitlement: boolean;
  maxWorkspaces: number;
  isEligibleToCreate: boolean;
}

/**
 * Pure evaluation function for workspace creation eligibility based on lifetime creations
 * and active user entitlements. Matches PostgreSQL create_workspace_with_admin logic.
 */
export function evaluateWorkspaceCreationLimit(
  lifetimeCreatedCount: number,
  entitlement?: { status: string; validUntil: string | Date; maxWorkspaces: number } | null
): UserEntitlementCheck {
  const isEntitlementActive =
    !!entitlement &&
    entitlement.status === 'active' &&
    new Date(entitlement.validUntil).getTime() > Date.now();

  const maxWorkspaces = isEntitlementActive
    ? entitlement.maxWorkspaces
    : DEFAULT_MAX_WORKSPACES_PER_USER;

  return {
    hasActiveEntitlement: isEntitlementActive,
    maxWorkspaces,
    isEligibleToCreate: lifetimeCreatedCount < maxWorkspaces,
  };
}

