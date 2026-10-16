import type { WorkspaceRole } from '@/types/database';

export interface WorkspaceMemberContext {
  userId: string;
  role: WorkspaceRole;
  displayName: string;
  slackUserId?: string;
}

export interface RoutingEvaluationInput {
  requesterMember: WorkspaceMemberContext;
  designatedLead: WorkspaceMemberContext | null;
  workspaceMembers: WorkspaceMemberContext[];
  explicitAssigneeSlackId?: string;
  isExistingTaskUpdate?: boolean;
  existingTaskIdentifier?: string;
}

export type RoutingRuleCode =
  | 'RULE_A_EXPLICIT_ASSIGNEE'
  | 'RULE_B_NO_ASSIGNEE_LEAD_QUEUE'
  | 'RULE_C_AMBIGUOUS_LEAD_TRIAGE'
  | 'RULE_D_EXPLICIT_LEAD_ASSIGNMENT'
  | 'RULE_E_INVALID_ASSIGNEE_REJECTED'
  | 'RULE_F_NO_DESIGNATED_LEAD'
  | 'RULE_G_EXISTING_TASK_UPDATE';

export interface RoutingDecision {
  ruleCode: RoutingRuleCode;
  action: 'assign_member' | 'route_to_lead_inbox' | 'update_existing' | 'reject' | 'warn_no_lead';
  assigneeUserId: string | null;
  assigneeDisplayName?: string;
  explanation: string;
  requiresLeadTriage: boolean;
  errorMessage?: string;
}

/**
 * Deterministic Task Routing Engine for Phase 2.
 * Strictly adheres to Rules A-G without synthetic or faked AI logic.
 */
export function evaluateTaskRouting({
  requesterMember,
  designatedLead,
  workspaceMembers,
  explicitAssigneeSlackId,
  isExistingTaskUpdate,
  existingTaskIdentifier,
}: RoutingEvaluationInput): RoutingDecision {
  // Rule G: Existing Task
  if (isExistingTaskUpdate && existingTaskIdentifier) {
    return {
      ruleCode: 'RULE_G_EXISTING_TASK_UPDATE',
      action: 'update_existing',
      assigneeUserId: null,
      explanation: `Identified existing task reference ${existingTaskIdentifier}. Updating existing task rather than creating a duplicate.`,
      requiresLeadTriage: false,
    };
  }

  // Rule F: No Designated Lead in Workspace
  if (!designatedLead) {
    return {
      ruleCode: 'RULE_F_NO_DESIGNATED_LEAD',
      action: 'warn_no_lead',
      assigneeUserId: null,
      explanation:
        'Workspace does not have a designated team lead configured. Tasks cannot be auto-triaged until an administrator assigns a lead.',
      requiresLeadTriage: false,
      errorMessage:
        'Workspace requires a designated team lead. An administrator must assign a lead in TaskPilot settings.',
    };
  }

  // Check if an explicit assignee was requested via Slack mention
  if (explicitAssigneeSlackId) {
    // Check if assignee is the designated lead
    if (designatedLead.slackUserId === explicitAssigneeSlackId) {
      // Rule D: Explicit Lead Assignment
      return {
        ruleCode: 'RULE_D_EXPLICIT_LEAD_ASSIGNMENT',
        action: 'assign_member',
        assigneeUserId: designatedLead.userId,
        assigneeDisplayName: designatedLead.displayName,
        explanation: `Task explicitly assigned to designated team lead ${designatedLead.displayName}.`,
        requiresLeadTriage: false,
      };
    }

    // Look for target member in workspace
    const targetMember = workspaceMembers.find(
      (m) => m.slackUserId === explicitAssigneeSlackId
    );

    if (!targetMember) {
      // Rule E: Invalid or Ineligible Assignee
      const memberNames = workspaceMembers.map((m) => m.displayName).join(', ');
      return {
        ruleCode: 'RULE_E_INVALID_ASSIGNEE_REJECTED',
        action: 'route_to_lead_inbox',
        assigneeUserId: null,
        explanation: `Mentioned Slack user <@${explicitAssigneeSlackId}> is not mapped to an active member in this TaskPilot workspace. Routed to team lead ${designatedLead.displayName} for manual allocation.`,
        requiresLeadTriage: true,
        errorMessage: `Target assignee is not mapped to this workspace. Valid members: ${memberNames}`,
      };
    }

    // Check authorization: Admins and Leads can assign anyone; Members can self-assign
    const isSelfAssignment = targetMember.userId === requesterMember.userId;
    const isPrivilegedAssigner =
      requesterMember.role === 'admin' || requesterMember.role === 'lead';

    if (isPrivilegedAssigner || isSelfAssignment) {
      // Rule A: Explicit Valid Assignee
      return {
        ruleCode: 'RULE_A_EXPLICIT_ASSIGNEE',
        action: 'assign_member',
        assigneeUserId: targetMember.userId,
        assigneeDisplayName: targetMember.displayName,
        explanation: `Assigned to ${targetMember.displayName} based on explicit request by ${requesterMember.displayName}.`,
        requiresLeadTriage: false,
      };
    } else {
      // Requester is ordinary member trying to assign to another member -> route to lead
      return {
        ruleCode: 'RULE_A_EXPLICIT_ASSIGNEE',
        action: 'route_to_lead_inbox',
        assigneeUserId: null,
        explanation: `${requesterMember.displayName} requested assignment to ${targetMember.displayName}, but ordinary members cannot reassign work. Routed to team lead ${designatedLead.displayName} for approval.`,
        requiresLeadTriage: true,
      };
    }
  }

  // Rule B: No Explicit Assignee -> Place in designated team lead's incoming triage queue
  return {
    ruleCode: 'RULE_B_NO_ASSIGNEE_LEAD_QUEUE',
    action: 'route_to_lead_inbox',
    assigneeUserId: null,
    explanation: `No assignee specified. Task created as unassigned and routed to designated lead ${designatedLead.displayName}'s incoming triage queue.`,
    requiresLeadTriage: true,
  };
}
