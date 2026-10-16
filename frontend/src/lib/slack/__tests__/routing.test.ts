import { describe, it, expect } from 'vitest';
import { evaluateTaskRouting, type WorkspaceMemberContext } from '../routing';

describe('evaluateTaskRouting', () => {
  const adminMember: WorkspaceMemberContext = {
    userId: 'user-admin-1',
    role: 'admin',
    displayName: 'Alice Admin',
    slackUserId: 'U_ADMIN',
  };

  const leadMember: WorkspaceMemberContext = {
    userId: 'user-lead-1',
    role: 'lead',
    displayName: 'Bob Lead',
    slackUserId: 'U_LEAD',
  };

  const devMember: WorkspaceMemberContext = {
    userId: 'user-dev-1',
    role: 'member',
    displayName: 'Charlie Dev',
    slackUserId: 'U_DEV1',
  };

  const devMember2: WorkspaceMemberContext = {
    userId: 'user-dev-2',
    role: 'member',
    displayName: 'Diana Dev',
    slackUserId: 'U_DEV2',
  };

  const allMembers = [adminMember, leadMember, devMember, devMember2];

  it('Rule B: routes unassigned task to lead triage queue when no assignee specified', () => {
    const decision = evaluateTaskRouting({
      requesterMember: devMember,
      designatedLead: leadMember,
      workspaceMembers: allMembers,
    });

    expect(decision.ruleCode).toBe('RULE_B_NO_ASSIGNEE_LEAD_QUEUE');
    expect(decision.action).toBe('route_to_lead_inbox');
    expect(decision.assigneeUserId).toBeNull();
    expect(decision.requiresLeadTriage).toBe(true);
  });

  it('Rule A: assigns directly when authorized lead specifies an eligible member', () => {
    const decision = evaluateTaskRouting({
      requesterMember: leadMember,
      designatedLead: leadMember,
      workspaceMembers: allMembers,
      explicitAssigneeSlackId: 'U_DEV1',
    });

    expect(decision.ruleCode).toBe('RULE_A_EXPLICIT_ASSIGNEE');
    expect(decision.action).toBe('assign_member');
    expect(decision.assigneeUserId).toBe('user-dev-1');
    expect(decision.requiresLeadTriage).toBe(false);
  });

  it('Rule A: allows member to self-assign a new task', () => {
    const decision = evaluateTaskRouting({
      requesterMember: devMember,
      designatedLead: leadMember,
      workspaceMembers: allMembers,
      explicitAssigneeSlackId: 'U_DEV1', // self
    });

    expect(decision.ruleCode).toBe('RULE_A_EXPLICIT_ASSIGNEE');
    expect(decision.action).toBe('assign_member');
    expect(decision.assigneeUserId).toBe('user-dev-1');
  });

  it('Rule A: routes to lead inbox when member tries to assign to another member without privilege', () => {
    const decision = evaluateTaskRouting({
      requesterMember: devMember,
      designatedLead: leadMember,
      workspaceMembers: allMembers,
      explicitAssigneeSlackId: 'U_DEV2', // another member
    });

    expect(decision.ruleCode).toBe('RULE_A_EXPLICIT_ASSIGNEE');
    expect(decision.action).toBe('route_to_lead_inbox');
    expect(decision.assigneeUserId).toBeNull();
    expect(decision.requiresLeadTriage).toBe(true);
  });

  it('Rule D: explicitly assigns to lead when lead is mentioned', () => {
    const decision = evaluateTaskRouting({
      requesterMember: devMember,
      designatedLead: leadMember,
      workspaceMembers: allMembers,
      explicitAssigneeSlackId: 'U_LEAD',
    });

    expect(decision.ruleCode).toBe('RULE_D_EXPLICIT_LEAD_ASSIGNMENT');
    expect(decision.action).toBe('assign_member');
    expect(decision.assigneeUserId).toBe('user-lead-1');
  });

  it('Rule E: handles invalid or unmapped Slack users by routing to lead with error details', () => {
    const decision = evaluateTaskRouting({
      requesterMember: devMember,
      designatedLead: leadMember,
      workspaceMembers: allMembers,
      explicitAssigneeSlackId: 'U_UNKNOWN_STRANGER',
    });

    expect(decision.ruleCode).toBe('RULE_E_INVALID_ASSIGNEE_REJECTED');
    expect(decision.action).toBe('route_to_lead_inbox');
    expect(decision.errorMessage).toContain('Target assignee is not mapped');
  });

  it('Rule F: detects absence of designated lead and warns administrator', () => {
    const decision = evaluateTaskRouting({
      requesterMember: devMember,
      designatedLead: null, // no lead
      workspaceMembers: allMembers,
    });

    expect(decision.ruleCode).toBe('RULE_F_NO_DESIGNATED_LEAD');
    expect(decision.action).toBe('warn_no_lead');
    expect(decision.errorMessage).toContain('requires a designated team lead');
  });

  it('Rule G: detects existing task update reference instead of creating duplicate', () => {
    const decision = evaluateTaskRouting({
      requesterMember: devMember,
      designatedLead: leadMember,
      workspaceMembers: allMembers,
      isExistingTaskUpdate: true,
      existingTaskIdentifier: 'CORE-14',
    });

    expect(decision.ruleCode).toBe('RULE_G_EXISTING_TASK_UPDATE');
    expect(decision.action).toBe('update_existing');
  });
});
