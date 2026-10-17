'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  User,
  AlertCircle,
  Clock,
  Send,
  MessageSquare,
  CheckCircle2,
  Loader2,
  GitPullRequest,
  GitCommit,
  ShieldCheck,
  Bot,
  ExternalLink,
  Plus,
  CheckCircle,
  AlertTriangle,
  Users,
} from '@/components/ui/pica-icons';
import { createClient } from '@/lib/supabase/client';
import type {
  TaskPriority,
  TaskStatus,
  WorkClaim,
  EvidenceArtifact,
  RoutingDecisionRecord,
  ClaimType,
  ClaimReviewState,
} from '@/types/database';

export interface TaskDetailData {
  id: string;
  workspace_id: string;
  project_id: string;
  task_number: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  created_by: string;
  due_date: string | null;
  source: string;
  slack_channel_id?: string | null;
  slack_message_ts?: string | null;
  slack_thread_ts?: string | null;
  assignment_type?: 'individual' | 'team';
  team_id?: string | null;
  status_reason?: string | null;
  status_changed_by?: string | null;
  status_changed_at?: string | null;
  created_at: string;
  updated_at: string;
  project?: {
    id: string;
    name: string;
    identifier: string;
  } | null;
  assignee?: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
}

interface MemberOption {
  user_id: string;
  role: string;
  display_name: string;
}

interface CommentItem {
  id: string;
  body: string;
  author_id: string;
  created_at: string;
  profiles?: {
    display_name: string;
    avatar_url: string | null;
  } | null;
}

interface TaskDetailDrawerProps {
  task: TaskDetailData | null;
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdated: () => void;
  members: MemberOption[];
  currentUserId: string | null;
  userRole: string | null;
}

export function TaskDetailDrawer({
  task,
  workspaceId,
  isOpen,
  onClose,
  onTaskUpdated,
  members,
  currentUserId,
  userRole,
}: TaskDetailDrawerProps) {
  const [status, setStatus] = useState<TaskStatus>('Todo');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);

  // Comments state
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [newComment, setNewComment] = useState<string>('');
  const [loadingComments, setLoadingComments] = useState<boolean>(false);
  const [savingComment, setSavingComment] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Evidence and Claims state
  const [claims, setClaims] = useState<(WorkClaim & { profiles?: { display_name: string } })[]>([]);
  const [artifacts, setArtifacts] = useState<
    (EvidenceArtifact & { github_repositories?: { owner: string; name: string } })[]
  >([]);
  const [routingDecision, setRoutingDecision] = useState<RoutingDecisionRecord | null>(null);
  const [loadingEvidence, setLoadingEvidence] = useState<boolean>(false);

  // Submit claim modal state
  const [isClaimModalOpen, setIsClaimModalOpen] = useState<boolean>(false);
  const [claimText, setClaimText] = useState<string>('');
  const [claimType, setClaimType] = useState<ClaimType>('implementation');
  const [claimArtifactUrl, setClaimArtifactUrl] = useState<string>('');
  const [submittingClaim, setSubmittingClaim] = useState<boolean>(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  // Mandatory status reason transition state
  const [pendingStatus, setPendingStatus] = useState<TaskStatus | null>(null);
  const [statusReason, setStatusReason] = useState<string>('');
  const [statusReasonSubmitting, setStatusReasonSubmitting] = useState<boolean>(false);
  const [statusReasonError, setStatusReasonError] = useState<string | null>(null);

  const handleConfirmStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingStatus || !task) return;
    if (statusReason.trim().length < 3) {
      setStatusReasonError('Please provide a meaningful reason (at least 3 characters).');
      return;
    }

    setStatusReasonSubmitting(true);
    setStatusReasonError(null);
    const supabase = createClient();

    try {
      const { error } = await supabase.rpc('update_task_status_with_reason', {
        p_task_id: task.id,
        p_new_status: pendingStatus,
        p_reason: statusReason.trim(),
      });

      if (error) {
        setStatusReasonError(error.message);
        setStatusReasonSubmitting(false);
        return;
      }

      setStatus(pendingStatus);
      setPendingStatus(null);
      setStatusReason('');
      onTaskUpdated();
    } catch (err) {
      setStatusReasonError(err instanceof Error ? err.message : 'Failed to update task status');
    } finally {
      setStatusReasonSubmitting(false);
    }
  };

  useEffect(() => {
    if (!task) return;

    setStatus(task.status);
    setPriority(task.priority);
    setAssigneeId(task.assignee_id || '');
    setDueDate(task.due_date || '');
    setDescription(task.description || '');
    setTitle(task.title);

    // Load comments
    loadComments(task.id);
    // Load evidence and claims
    loadEvidenceAndClaims(task.id);
  }, [task]);

  const loadEvidenceAndClaims = async (taskId: string) => {
    setLoadingEvidence(true);
    const supabase = createClient();
    try {
      const [claimsRes, artifactsRes, routingRes] = await Promise.all([
        supabase
          .from('work_claims')
          .select(`
            *,
            profiles:claimant_id (
              display_name
            )
          `)
          .eq('task_id', taskId)
          .order('created_at', { ascending: false }),
        supabase
          .from('evidence_artifacts')
          .select(`
            *,
            github_repositories:repository_id (
              owner,
              name
            )
          `)
          .eq('task_id', taskId)
          .order('created_at', { ascending: false }),
        supabase
          .from('routing_decisions')
          .select('*')
          .eq('task_id', taskId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (claimsRes.data) {
        setClaims(claimsRes.data as any);
      }
      if (artifactsRes.data) {
        setArtifacts(artifactsRes.data as any);
      }
      if (routingRes.data) {
        setRoutingDecision(routingRes.data as any);
      } else {
        setRoutingDecision(null);
      }
    } catch (err) {
      console.error('Failed to load evidence/claims:', err);
    } finally {
      setLoadingEvidence(false);
    }
  };

  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimText.trim() || !currentUserId || !task) return;

    setSubmittingClaim(true);
    setClaimError(null);
    const supabase = createClient();

    try {
      const { data: claim, error } = await supabase
        .from('work_claims')
        .insert({
          workspace_id: workspaceId,
          task_id: task.id,
          claimant_id: currentUserId,
          claim_source: 'dashboard',
          claim_text: claimText.trim(),
          claim_type: claimType,
          pr_url_hint: claimArtifactUrl.trim() || null,
          review_state: 'pending',
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      // Log activity event
      await supabase.from('activity_events').insert({
        workspace_id: workspaceId,
        actor_id: currentUserId,
        entity_type: 'task',
        entity_id: task.id,
        event_type: 'work_claim_submitted',
        metadata: {
          task_identifier: `${task.project?.identifier}-${task.task_number}`,
          claim_id: claim.id,
          claim_type: claimType,
        },
      });

      // If user provided a GitHub PR or commit URL, trigger background sync
      if (claimArtifactUrl.trim()) {
        try {
          await fetch('/api/github/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workspaceId, syncAll: true }),
          });
        } catch {
          // Non-blocking sync trigger
        }
      }

      setClaimText('');
      setClaimArtifactUrl('');
      setIsClaimModalOpen(false);
      loadEvidenceAndClaims(task.id);
      onTaskUpdated();
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : 'Failed to submit work claim');
    } finally {
      setSubmittingClaim(false);
    }
  };

  const loadComments = async (taskId: string) => {
    setLoadingComments(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('task_comments')
      .select(`
        id,
        body,
        author_id,
        created_at,
        profiles:author_id (
          display_name,
          avatar_url
        )
      `)
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    if (data) {
      setComments(data as unknown as CommentItem[]);
    }
    setLoadingComments(false);
  };

  if (!isOpen || !task) return null;

  const handleFieldUpdate = async (field: string, value: any) => {
    const supabase = createClient();
    try {
      setSaveStatus('Saving...');
      const { error } = await supabase
        .from('tasks')
        .update({
          [field]: value,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', task.id);

      if (error) {
        setSaveStatus(`Error: ${error.message}`);
        return;
      }

      // Log activity
      if (currentUserId) {
        await supabase.from('activity_events').insert({
          workspace_id: workspaceId,
          actor_id: currentUserId,
          entity_type: 'task',
          entity_id: task.id,
          event_type: field === 'status' ? 'status_changed' : field === 'assignee_id' ? 'assigned' : 'updated',
          metadata: {
            field,
            old_value: (task as any)[field],
            new_value: value,
            task_identifier: `${task.project?.identifier}-${task.task_number}`,
          },
        });
      }

      setSaveStatus('Saved');
      setTimeout(() => setSaveStatus(null), 1500);
      onTaskUpdated();
    } catch (err) {
      setSaveStatus(err instanceof Error ? err.message : 'Save failed');
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !currentUserId) return;

    setSavingComment(true);
    const supabase = createClient();

    try {
      const { error } = await supabase.from('task_comments').insert({
        task_id: task.id,
        author_id: currentUserId,
        body: newComment.trim(),
      });

      if (!error) {
        setNewComment('');
        loadComments(task.id);
        // Log activity
        await supabase.from('activity_events').insert({
          workspace_id: workspaceId,
          actor_id: currentUserId,
          entity_type: 'task',
          entity_id: task.id,
          event_type: 'comment_added',
          metadata: {
            task_identifier: `${task.project?.identifier}-${task.task_number}`,
          },
        });
      }
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      setSavingComment(false);
    }
  };

  const isAssignable = userRole === 'admin' || userRole === 'lead';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-xl h-full bg-zinc-950 border-l border-zinc-800 flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-zinc-800 text-indigo-400 border border-zinc-700">
              {task.project?.identifier}-{task.task_number}
            </span>
            <span className="text-xs text-zinc-400 font-medium truncate max-w-[200px]">
              {task.project?.name}
            </span>
            {saveStatus && (
              <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-1 ml-2">
                <CheckCircle2 className="h-3 w-3 text-emerald-400" /> {saveStatus}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Title */}
          <div className="space-y-1">
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1 text-sm font-semibold text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={() => {
                    handleFieldUpdate('title', title.trim());
                    setIsEditingTitle(false);
                  }}
                  className="px-2.5 py-1 rounded bg-indigo-600 text-xs font-medium text-white hover:bg-indigo-500"
                >
                  Save
                </button>
              </div>
            ) : (
              <h2
                onClick={() => setIsEditingTitle(true)}
                title="Click to edit title"
                className="text-base sm:text-lg font-bold text-zinc-100 cursor-pointer hover:text-indigo-300 transition-colors"
              >
                {title}
              </h2>
            )}
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <span className="text-[11px] text-zinc-500 font-mono">
                Created {new Date(task.created_at).toLocaleDateString()}
              </span>
              {task.assignment_type === 'team' && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center gap-1">
                  <Users className="h-3 w-3" /> Team Task
                </span>
              )}
              {task.source === 'slack' ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" /> Slack Origin
                  {task.slack_channel_id && ` (${task.slack_channel_id})`}
                </span>
              ) : (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                  Source: {task.source}
                </span>
              )}
            </div>

            {routingDecision && (
              <div className="mt-2.5 p-3 rounded-xl border border-indigo-500/30 bg-indigo-500/5 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
                    <Bot className="h-3.5 w-3.5 text-indigo-400" />
                    Agent Routing Transparency
                  </span>
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                    {routingDecision.decision_method.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-zinc-300 text-[11px] leading-relaxed">
                  {routingDecision.rationale || 'Task was processed by intelligent routing engine.'}
                </p>
                {routingDecision.human_intervention_needed && (
                  <span className="text-[10px] font-mono text-amber-400 block">
                    * Flagged for team lead triage
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Properties Grid */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 text-xs">
            {/* Status Selector */}
            <div className="space-y-1">
              <label className="text-[11px] text-zinc-400">Status</label>
              <select
                value={status}
                onChange={(e) => {
                  const val = e.target.value as TaskStatus;
                  if (val !== status) {
                    setPendingStatus(val);
                    setStatusReason('');
                    setStatusReasonError(null);
                  }
                }}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="Backlog">Backlog</option>
                <option value="Todo">Todo</option>
                <option value="In Progress">In Progress</option>
                <option value="In Review">In Review</option>
                <option value="Blocked">Blocked</option>
                <option value="Done">Done</option>
                <option value="Cancelled">Cancelled</option>
              </select>

              {task.status_reason && (
                <div className="p-2 rounded bg-zinc-950/80 border border-zinc-800 text-[11px] text-zinc-400 mt-1.5 space-y-0.5">
                  <span className="text-[10px] font-mono uppercase text-zinc-500 block font-semibold">
                    Current Status Reason:
                  </span>
                  <p className="text-zinc-300 italic">&ldquo;{task.status_reason}&rdquo;</p>
                  {task.status_changed_at && (
                    <span className="text-[10px] font-mono text-zinc-500 block pt-0.5">
                      Updated {new Date(task.status_changed_at).toLocaleString()}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Priority Selector */}
            <div className="space-y-1">
              <label className="text-[11px] text-zinc-400">Priority</label>
              <select
                value={priority}
                onChange={(e) => {
                  const val = e.target.value as TaskPriority;
                  setPriority(val);
                  handleFieldUpdate('priority', val);
                }}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>

            {/* Assignee Selector */}
            <div className="space-y-1">
              <label className="text-[11px] text-zinc-400 flex items-center gap-1">
                <User className="h-3 w-3" /> Assignee
              </label>
              <select
                value={assigneeId}
                disabled={!isAssignable && currentUserId !== task.assignee_id}
                onChange={(e) => {
                  const val = e.target.value;
                  setAssigneeId(val);
                  handleFieldUpdate('assignee_id', val || null);
                }}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              >
                <option value="">Unassigned (Incoming Inbox)</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.display_name} ({m.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Due Date */}
            <div className="space-y-1">
              <label className="text-[11px] text-zinc-400 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setDueDate(val);
                  handleFieldUpdate('due_date', val || null);
                }}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Description Section */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-300">Description</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => handleFieldUpdate('description', description.trim() || null)}
              placeholder="Add technical specifications, context, or links..."
              className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
            />
          </div>

          {/* Phase 3: Work Claims & GitHub Evidence Section */}
          <div className="space-y-4 pt-4 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-purple-400" /> Verifiable Evidence &amp; Work Claims
                </h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Explicit work claims correlated against GitHub commits, PRs, and CI checks.
                </p>
              </div>

              <button
                onClick={() => setIsClaimModalOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-xs font-medium transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Submit Work Claim
              </button>
            </div>

            {/* Claims List */}
            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold block">
                Work Claims ({claims.length})
              </span>
              {loadingEvidence ? (
                <div className="text-center py-3 text-xs text-zinc-500 font-mono">Loading claims...</div>
              ) : claims.length === 0 ? (
                <div className="p-3 rounded-lg border border-dashed border-zinc-800 text-center text-xs text-zinc-500">
                  No work claims submitted yet for this task.
                </div>
              ) : (
                claims.map((claim) => {
                  const stateConfig: Record<ClaimReviewState, { label: string; cls: string }> = {
                    pending: {
                      label: 'Awaiting Admin Review',
                      cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                    },
                    supported: {
                      label: 'Supported by GitHub Evidence',
                      cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                    },
                    partially_supported: {
                      label: 'Partially Supported',
                      cls: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
                    },
                    needs_clarification: {
                      label: 'Needs Clarification',
                      cls: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
                    },
                    unverified: {
                      label: 'Insufficient Evidence',
                      cls: 'bg-zinc-800 text-zinc-400 border-zinc-700',
                    },
                    disputed: {
                      label: 'Disputed / Escalated',
                      cls: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
                    },
                  };
                  const currentCfg = stateConfig[claim.review_state] || {
                    label: claim.review_state,
                    cls: 'bg-zinc-800 text-zinc-400',
                  };

                  return (
                    <div
                      key={claim.id}
                      className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-900/60 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-zinc-200">
                            {claim.profiles?.display_name || 'Member'}
                          </span>
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                            {claim.claim_type.replace('_', ' ')}
                          </span>
                        </div>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${currentCfg.cls}`}>
                          {currentCfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed font-sans">{claim.claim_text}</p>
                      {claim.review_rationale && (
                        <div className="p-2 rounded bg-zinc-950 border border-zinc-800/80 text-[11px] text-zinc-400 space-y-0.5">
                          <span className="text-[10px] font-mono text-zinc-500 uppercase block font-semibold">
                            Admin Review Rationale:
                          </span>
                          <p>{claim.review_rationale}</p>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono pt-1 border-t border-zinc-800/40">
                        <span>Submitted via {claim.claim_source}</span>
                        <span>{new Date(claim.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Artifacts List */}
            <div className="space-y-2 pt-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold block">
                Associated GitHub Artifacts ({artifacts.length})
              </span>
              {artifacts.length === 0 ? (
                <div className="p-3 rounded-lg border border-dashed border-zinc-800 text-center text-xs text-zinc-500">
                  No GitHub artifacts linked yet. Connect a repository and mention this task identifier in PR titles or commit messages.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {artifacts.map((art) => {
                    const repoName = art.github_repositories
                      ? `${art.github_repositories.owner}/${art.github_repositories.name}`
                      : 'Repository';

                    return (
                      <div
                        key={art.id}
                        className="p-2.5 rounded-lg border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/70 transition-colors flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {art.artifact_type === 'pull_request' && (
                            <GitPullRequest className="h-4 w-4 text-purple-400 shrink-0" />
                          )}
                          {art.artifact_type === 'commit' && (
                            <GitCommit className="h-4 w-4 text-indigo-400 shrink-0" />
                          )}
                          {art.artifact_type === 'check_run' &&
                            (art.artifact_state === 'success' ? (
                              <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                            ))}
                          {art.artifact_type === 'review' && (
                            <ShieldCheck className="h-4 w-4 text-blue-400 shrink-0" />
                          )}

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-[11px] text-zinc-200 truncate">
                                {art.artifact_type === 'pull_request' &&
                                  `PR #${(art.metadata as any)?.number || art.external_id}`}
                                {art.artifact_type === 'commit' &&
                                  `Commit ${art.commit_sha?.slice(0, 7)}`}
                                {art.artifact_type === 'check_run' &&
                                  `${(art.metadata as any)?.name || 'Check'}`}
                                {art.artifact_type === 'review' &&
                                  `Review by @${art.author_login || 'reviewer'}`}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                                {art.artifact_state}
                              </span>
                            </div>
                            <span className="text-[10px] text-zinc-500 font-mono block truncate">
                              {repoName} &bull; {art.match_method.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>

                        {art.source_url && (
                          <a
                            href={art.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 shrink-0"
                            title="Open in GitHub"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Comments and Notes Section */}
          <div className="space-y-3 pt-4 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-indigo-400" /> Discussion &amp; Progress Notes
              </h3>
              <span className="text-[11px] font-mono text-zinc-500">{comments.length}</span>
            </div>

            {/* Comments List */}
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {loadingComments ? (
                <div className="text-center py-4 text-xs text-zinc-500 font-mono">Loading notes...</div>
              ) : comments.length === 0 ? (
                <div className="text-center py-4 text-xs text-zinc-600 bg-zinc-900/20 rounded-lg border border-dashed border-zinc-800/80">
                  No notes recorded yet. Post progress updates below.
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="p-3 rounded-lg border border-zinc-800/80 bg-zinc-900/50 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-zinc-300">
                        {comment.profiles?.display_name || 'Member'}
                      </span>
                      <span className="text-zinc-500 font-mono text-[10px]">
                        {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">{comment.body}</p>
                  </div>
                ))
              )}
            </div>

            {/* Add Comment Box */}
            <form onSubmit={handleAddComment} className="pt-2 flex gap-2">
              <input
                type="text"
                placeholder="Write a progress note or comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={savingComment || !newComment.trim()}
                className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors disabled:opacity-50 shrink-0"
              >
                {savingComment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </button>
            </form>
          </div>
        </div>

        {/* Submit Work Claim Modal */}
        {isClaimModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-purple-400" /> Submit Work Claim
                </h3>
                <button
                  onClick={() => setIsClaimModalOpen(false)}
                  className="p-1 rounded-md text-zinc-400 hover:text-zinc-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {claimError && (
                <div className="p-3 rounded-lg border border-rose-900/40 bg-rose-950/20 text-rose-300 text-xs">
                  {claimError}
                </div>
              )}

              <form onSubmit={handleSubmitClaim} className="space-y-3.5 text-xs">
                <div className="space-y-1">
                  <label className="font-medium text-zinc-300">Claim Type</label>
                  <select
                    value={claimType}
                    onChange={(e) => setClaimType(e.target.value as ClaimType)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-purple-500"
                  >
                    <option value="implementation">Implementation (New Code)</option>
                    <option value="bug_fix">Bug Fix</option>
                    <option value="code_review">Code Review</option>
                    <option value="test_coverage">Test Coverage</option>
                    <option value="documentation">Documentation</option>
                    <option value="progress_update">Progress Update</option>
                    <option value="completion">Completion / Delivery</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-zinc-300">Work Assertion / Description</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="e.g. Implemented OAuth callback handling, wrote integration tests, and opened PR #42."
                    value={claimText}
                    onChange={(e) => setClaimText(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-zinc-100 focus:outline-none focus:border-purple-500 resize-none leading-relaxed"
                  />
                  <p className="text-[10px] text-zinc-500">
                    Be explicit and factual. This claim will be compared against actual GitHub artifacts during human review.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-zinc-300">
                    GitHub PR or Commit URL <span className="text-zinc-500 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="url"
                    placeholder="https://github.com/owner/repo/pull/42"
                    value={claimArtifactUrl}
                    onChange={(e) => setClaimArtifactUrl(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsClaimModalOpen(false)}
                    className="px-3.5 py-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingClaim || !claimText.trim()}
                    className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium disabled:opacity-50"
                  >
                    {submittingClaim ? 'Submitting...' : 'Submit Claim'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Status Transition Reason Modal */}
        {pendingStatus && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                    {status} &rarr; {pendingStatus}
                  </span>
                  <h3 className="text-sm font-semibold text-zinc-100">
                    Status Change Reason
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingStatus(null)}
                  className="p-1 rounded-md text-zinc-400 hover:text-zinc-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="text-xs text-zinc-400 leading-relaxed">
                TaskPilot requires an audit reason for all status transitions to maintain transparency across teams.
              </p>

              {statusReasonError && (
                <div className="p-3 rounded-lg border border-rose-900/40 bg-rose-950/20 text-rose-300 text-xs">
                  {statusReasonError}
                </div>
              )}

              <form onSubmit={handleConfirmStatusChange} className="space-y-3.5 text-xs">
                <div className="space-y-1">
                  <label className="font-medium text-zinc-300">
                    Reason / Context <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    autoFocus
                    placeholder="e.g. Blocked on API specification from backend team, or: Completed code review and merged PR."
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-zinc-100 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
                  />
                  <span className="text-[10px] text-zinc-500">
                    Minimum 3 characters required.
                  </span>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingStatus(null)}
                    className="px-3.5 py-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={statusReasonSubmitting || statusReason.trim().length < 3}
                    className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {statusReasonSubmitting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
                      </>
                    ) : (
                      'Confirm Status Change'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
