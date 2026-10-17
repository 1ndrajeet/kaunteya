import { SupabaseClient } from '@supabase/supabase-js';
import type { WorkspaceMemberContext, RoutingDecision } from '../slack/routing';
import { evaluateTaskRouting } from '../slack/routing';

export interface ProjectContext {
  id: string;
  name: string;
  identifier: string;
  leadId?: string | null;
  repositories?: { id: string; fullName: string }[];
}

export interface MemberWorkloadContext extends WorkspaceMemberContext {
  openTaskCount: number;
  recentTaskTitles?: string[];
  githubLogin?: string;
}

export interface AgentRoutingInput {
  requesterMember: WorkspaceMemberContext;
  designatedLead: WorkspaceMemberContext | null;
  workspaceMembers: MemberWorkloadContext[];
  projects: ProjectContext[];
  rawRequestText: string;
  explicitAssigneeSlackId?: string;
  projectNameHint?: string;
  isExistingTaskUpdate?: boolean;
  existingTaskIdentifier?: string;
}

export interface AgentRoutingResult {
  decision: RoutingDecision;
  decisionMethod: 'deterministic' | 'agent_proposal' | 'human_override';
  proposedProjectId?: string;
  proposedAssigneeId?: string | null;
  confidence: 'high' | 'medium' | 'low';
  rationale: string;
  humanInterventionNeeded: boolean;
  modelOutputRaw?: any;
}

/**
 * Validates that an assignee ID proposed by the model actually belongs
 * to an eligible workspace member. Prevents hallucinations and privilege escalations.
 */
function validateProposedAssignee(
  proposedId: string | null | undefined,
  candidates: MemberWorkloadContext[]
): MemberWorkloadContext | null {
  if (!proposedId) return null;
  return candidates.find((m) => m.userId === proposedId) || null;
}

/**
 * Validates that a project ID proposed by the model belongs to the workspace.
 */
export function validateProposedProject(
  proposedId: string | null | undefined,
  projects: ProjectContext[]
): ProjectContext | null {
  if (!proposedId) return null;
  return projects.find((p) => p.id === proposedId || p.identifier.toUpperCase() === proposedId.toUpperCase()) || null;
}

/**
 * Heuristic fallback evaluator when LLM API is unavailable or unconfigured.
 * Balances workload by recommending the eligible member with the fewest open tasks.
 */
function evaluateHeuristicRecommendation(
  input: AgentRoutingInput,
  resolvedProject: ProjectContext
): AgentRoutingResult {
  const eligibleMembers = input.workspaceMembers.filter(
    (m) => m.role === 'member' || m.role === 'lead'
  );

  if (eligibleMembers.length === 0) {
    return {
      decision: {
        ruleCode: 'RULE_B_NO_ASSIGNEE_LEAD_QUEUE',
        action: 'route_to_lead_inbox',
        assigneeUserId: null,
        explanation: 'No eligible members found. Routed to lead triage.',
        requiresLeadTriage: true,
      },
      decisionMethod: 'deterministic',
      proposedProjectId: resolvedProject.id,
      proposedAssigneeId: null,
      confidence: 'low',
      rationale: 'No eligible members in workspace; routed to team lead queue.',
      humanInterventionNeeded: true,
    };
  }

  // Find member with lowest open task count
  const sortedByWorkload = [...eligibleMembers].sort((a, b) => a.openTaskCount - b.openTaskCount);
  const candidate = sortedByWorkload[0];

  return {
    decision: {
      ruleCode: 'RULE_B_NO_ASSIGNEE_LEAD_QUEUE',
      action: 'route_to_lead_inbox', // Still routed to lead inbox with explicit recommendation!
      assigneeUserId: null,
      assigneeDisplayName: candidate.displayName,
      explanation: `Contextual Agent Recommendation: Suggesting ${candidate.displayName} (lowest open workload: ${candidate.openTaskCount} tasks) for ${resolvedProject.identifier}. Awaiting team lead allocation.`,
      requiresLeadTriage: true,
    },
    decisionMethod: 'agent_proposal',
    proposedProjectId: resolvedProject.id,
    proposedAssigneeId: candidate.userId,
    confidence: 'medium',
    rationale: `Selected ${candidate.displayName} based on current open workload balance (${candidate.openTaskCount} active tasks across ${resolvedProject.name}).`,
    humanInterventionNeeded: true,
  };
}

/**
 * Agent-assisted Task Routing Engine.
 * Evaluates request against Rules 1-7, prioritizing deterministic rules,
 * then invoking structured contextual recommendation, with strict safety validations.
 */
export async function evaluateAgentAssistedRouting(
  input: AgentRoutingInput
): Promise<AgentRoutingResult> {
  // 1. Rule 1, 2, F, D, E, A: Check if explicit assignee or existing task is handled deterministically
  if (
    input.explicitAssigneeSlackId ||
    input.isExistingTaskUpdate ||
    !input.designatedLead
  ) {
    const deterministic = evaluateTaskRouting({
      requesterMember: input.requesterMember,
      designatedLead: input.designatedLead,
      workspaceMembers: input.workspaceMembers,
      explicitAssigneeSlackId: input.explicitAssigneeSlackId,
      isExistingTaskUpdate: input.isExistingTaskUpdate,
      existingTaskIdentifier: input.existingTaskIdentifier,
    });

    return {
      decision: deterministic,
      decisionMethod: 'deterministic',
      proposedAssigneeId: deterministic.assigneeUserId,
      confidence: 'high',
      rationale: deterministic.explanation,
      humanInterventionNeeded: deterministic.requiresLeadTriage,
    };
  }

  // 2. Resolve Project
  let resolvedProject = input.projects[0];
  if (input.projectNameHint) {
    const hint = input.projectNameHint.toLowerCase();
    const matched = input.projects.find(
      (p) =>
        p.identifier.toLowerCase() === hint ||
        p.name.toLowerCase().includes(hint)
    );
    if (matched) resolvedProject = matched;
  }

  if (!resolvedProject) {
    return {
      decision: {
        ruleCode: 'RULE_C_AMBIGUOUS_LEAD_TRIAGE',
        action: 'route_to_lead_inbox',
        assigneeUserId: null,
        explanation: 'No matching project found. Routed to lead for project triage.',
        requiresLeadTriage: true,
      },
      decisionMethod: 'deterministic',
      confidence: 'low',
      rationale: 'Could not resolve project destination.',
      humanInterventionNeeded: true,
    };
  }

  // 3. Rule 3: Clear project ownership (e.g. project lead designated)
  if (resolvedProject.leadId) {
    const projectLead = input.workspaceMembers.find((m) => m.userId === resolvedProject.leadId);
    if (projectLead && projectLead.userId === input.designatedLead.userId) {
      // Clear lead assignment
      return {
        decision: {
          ruleCode: 'RULE_D_EXPLICIT_LEAD_ASSIGNMENT',
          action: 'route_to_lead_inbox',
          assigneeUserId: null,
          assigneeDisplayName: projectLead.displayName,
          explanation: `Project ${resolvedProject.name} is led by ${projectLead.displayName}. Placed in incoming triage queue.`,
          requiresLeadTriage: true,
        },
        decisionMethod: 'deterministic',
        proposedProjectId: resolvedProject.id,
        proposedAssigneeId: projectLead.userId,
        confidence: 'high',
        rationale: `Direct project lead association for ${resolvedProject.identifier}.`,
        humanInterventionNeeded: true,
      };
    }
  }

  // 4. Rule 4: Contextual Recommendation (Heuristic + Model evaluation)
  // Check if an LLM key is configured in environment
  const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;

  if (apiKey) {
    try {
      // Build safe sanitized prompt with candidate IDs strictly bounded
      const candidateSummary = input.workspaceMembers.map((m) => ({
        id: m.userId,
        name: m.displayName,
        role: m.role,
        openTasks: m.openTaskCount,
      }));

      const promptPayload = {
        taskDescription: input.rawRequestText.slice(0, 300),
        project: { id: resolvedProject.id, name: resolvedProject.name, identifier: resolvedProject.identifier },
        candidates: candidateSummary,
      };

      // Call Gemini 2.5 / 1.5 API with strict JSON schema if GEMINI_API_KEY is present
      if (process.env.GEMINI_API_KEY) {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `You are an AI task routing agent. Based on the task description and candidate members, recommend the best assignee.\n\nContext:\n${JSON.stringify(promptPayload)}\n\nRespond ONLY with valid JSON matching:\n{"proposedAssigneeId": "<one of candidate ids or null>", "confidence": "high"|"medium"|"low", "rationale": "<factual explanation based on workload and task skills>"}`
                    }
                  ]
                }
              ],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.1,
              }
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const parsed = JSON.parse(rawText);
            const validatedAssignee = validateProposedAssignee(parsed.proposedAssigneeId, input.workspaceMembers);

            if (validatedAssignee) {
              return {
                decision: {
                  ruleCode: 'RULE_B_NO_ASSIGNEE_LEAD_QUEUE',
                  action: 'route_to_lead_inbox',
                  assigneeUserId: null,
                  assigneeDisplayName: validatedAssignee.displayName,
                  explanation: `Agent Recommendation: ${parsed.rationale || `Recommended ${validatedAssignee.displayName} for ${resolvedProject.identifier}`}`,
                  requiresLeadTriage: true,
                },
                decisionMethod: 'agent_proposal',
                proposedProjectId: resolvedProject.id,
                proposedAssigneeId: validatedAssignee.userId,
                confidence: parsed.confidence || 'medium',
                rationale: parsed.rationale || `Selected based on context and workload balance.`,
                humanInterventionNeeded: true,
                modelOutputRaw: parsed,
              };
            }
          }
        }
      }
    } catch (err: any) {
      console.warn('[Agent Router] LLM call failed or returned malformed data; falling back to heuristic:', err?.message);
    }
  }

  // 5. Fallback to transparent Workload-Balanced Heuristic (Deterministic & Explainable)
  return evaluateHeuristicRecommendation(input, resolvedProject);
}

/**
 * Persists a routing decision record and creates an audit activity event.
 */
export async function persistRoutingDecision(
  supabase: SupabaseClient,
  workspaceId: string,
  taskId: string,
  result: AgentRoutingResult,
  requestSource: 'slack' | 'web_ui' | 'api' = 'slack'
): Promise<string | null> {
  try {
    const { data: record, error } = await supabase
      .from('routing_decisions')
      .insert({
        workspace_id: workspaceId,
        task_id: taskId,
        request_source: requestSource,
        decision_version: 'v3.0',
        proposed_project_id: result.proposedProjectId || null,
        proposed_assignee_id: result.proposedAssigneeId || null,
        selected_outcome: result.decision.assigneeUserId ? 'assigned' : 'lead_triage',
        decision_method: result.decisionMethod,
        rule_code: result.decision.ruleCode,
        rationale: result.rationale,
        confidence: result.confidence,
        human_intervention_needed: result.humanInterventionNeeded,
        metadata: {
          requiresLeadTriage: result.decision.requiresLeadTriage,
          assigneeDisplayName: result.decision.assigneeDisplayName,
        },
      })
      .select('id')
      .single();

    if (error) {
      console.error('[Agent Router] Failed to persist routing decision:', error);
      return null;
    }

    // Record Activity Event
    await supabase.from('activity_events').insert({
      workspace_id: workspaceId,
      actor_id: null,
      entity_type: 'task',
      entity_id: taskId,
      event_type: 'routing_recommendation_generated',
      metadata: {
        decision_method: result.decisionMethod,
        proposed_assignee_id: result.proposedAssigneeId,
        confidence: result.confidence,
        rationale: result.rationale,
      },
    });

    return record?.id || null;
  } catch (err: any) {
    console.error('[Agent Router] Exception persisting routing decision:', err);
    return null;
  }
}
