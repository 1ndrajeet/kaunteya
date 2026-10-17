import { describe, it, expect } from 'vitest';
import { evaluateAgentAssistedRouting } from '../agent-router';
import type { WorkspaceMemberContext } from '../../slack/routing';
import type { MemberWorkloadContext, ProjectContext } from '../agent-router';

describe('Agent-Assisted Task Routing Engine', () => {
  const adminMember: WorkspaceMemberContext = {
    userId: 'user-admin',
    role: 'admin',
    displayName: 'Admin User',
    slackUserId: 'UADMIN',
  };

  const leadMember: WorkspaceMemberContext = {
    userId: 'user-lead',
    role: 'lead',
    displayName: 'Sarah Lead',
    slackUserId: 'ULEAD',
  };

  const memberAlice: MemberWorkloadContext = {
    userId: 'user-alice',
    role: 'member',
    displayName: 'Alice Engineer',
    slackUserId: 'UALICE',
    openTaskCount: 1, // Low workload
  };

  const memberBob: MemberWorkloadContext = {
    userId: 'user-bob',
    role: 'member',
    displayName: 'Bob Developer',
    slackUserId: 'UBOB',
    openTaskCount: 5, // High workload
  };

  const projectAuth: ProjectContext = {
    id: 'proj-auth',
    name: 'Authentication Platform',
    identifier: 'AUTH',
  };

  it('preserves Rule A for explicit valid assignee requests', async () => {
    const result = await evaluateAgentAssistedRouting({
      requesterMember: adminMember,
      designatedLead: leadMember,
      workspaceMembers: [
        { ...adminMember, openTaskCount: 0 },
        { ...leadMember, openTaskCount: 2 },
        memberAlice,
        memberBob,
      ],
      projects: [projectAuth],
      rawRequestText: 'Create task for Alice',
      explicitAssigneeSlackId: 'UALICE',
    });

    expect(result.decisionMethod).toBe('deterministic');
    expect(result.decision.ruleCode).toBe('RULE_A_EXPLICIT_ASSIGNEE');
    expect(result.decision.assigneeUserId).toBe('user-alice');
    expect(result.decision.action).toBe('assign_member');
  });

  it('recommends member with lowest open workload when no assignee is specified', async () => {
    const result = await evaluateAgentAssistedRouting({
      requesterMember: adminMember,
      designatedLead: leadMember,
      workspaceMembers: [
        { ...adminMember, openTaskCount: 0 },
        { ...leadMember, openTaskCount: 2 },
        memberAlice, // 1 open task
        memberBob,   // 5 open tasks
      ],
      projects: [projectAuth],
      rawRequestText: 'Add rate limiting to login endpoint in AUTH project',
    });

    expect(result.decisionMethod).toBe('agent_proposal');
    expect(result.proposedAssigneeId).toBe('user-alice');
    expect(result.decision.assigneeDisplayName).toBe('Alice Engineer');
    expect(result.decision.requiresLeadTriage).toBe(true);
    expect(result.rationale).toContain('workload');
  });

  it('triggers Rule F when no designated lead exists in workspace', async () => {
    const result = await evaluateAgentAssistedRouting({
      requesterMember: adminMember,
      designatedLead: null,
      workspaceMembers: [
        { ...adminMember, openTaskCount: 0 },
        memberAlice,
      ],
      projects: [projectAuth],
      rawRequestText: 'Create task without a lead',
    });

    expect(result.decision.ruleCode).toBe('RULE_F_NO_DESIGNATED_LEAD');
    expect(result.decision.action).toBe('warn_no_lead');
  });

  it('rejects invalid Slack assignee mention and routes to lead inbox', async () => {
    const result = await evaluateAgentAssistedRouting({
      requesterMember: adminMember,
      designatedLead: leadMember,
      workspaceMembers: [
        { ...adminMember, openTaskCount: 0 },
        { ...leadMember, openTaskCount: 2 },
        memberAlice,
      ],
      projects: [projectAuth],
      rawRequestText: 'Assign to unknown user',
      explicitAssigneeSlackId: 'UUNKNOWN99',
    });

    expect(result.decision.ruleCode).toBe('RULE_E_INVALID_ASSIGNEE_REJECTED');
    expect(result.decision.action).toBe('route_to_lead_inbox');
    expect(result.decision.assigneeUserId).toBeNull();
  });
});
