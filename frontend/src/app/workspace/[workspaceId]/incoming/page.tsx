'use client';

import React, { useState, useEffect, use } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  User,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Bot,
  Loader2,
  Plus,
  MessageSquare,
} from '@/components/ui/pica-icons';
import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/features/workspace/workspace-context';
import type { TaskPriority, TaskStatus, RoutingDecisionRecord } from '@/types/database';

interface UnassignedTask {
  id: string;
  task_number: number;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  source: string;
  slack_channel_id: string | null;
  slack_message_ts: string | null;
  created_at: string;
  project: {
    id: string;
    name: string;
    identifier: string;
  } | null;
}

interface MemberOption {
  user_id: string;
  role: string;
  display_name: string;
}

export default function IncomingTriagePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const unwrappedParams = use(params);
  const workspaceId = unwrappedParams.workspaceId;
  const { role, user, setIsCreateTaskOpen } = useWorkspace();

  const [tasks, setTasks] = useState<UnassignedTask[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [routingMap, setRoutingMap] = useState<Record<string, RoutingDecisionRecord>>({});
  const [sourceFilter, setSourceFilter] = useState<'all' | 'slack' | 'manual'>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const fetchUnassigned = async () => {
    setLoading(true);
    const supabase = createClient();

    // 1. Fetch unassigned tasks
    const { data: taskData, error } = await supabase
      .from('tasks')
      .select(`
        id,
        task_number,
        title,
        description,
        priority,
        status,
        due_date,
        source,
        slack_channel_id,
        slack_message_ts,
        created_at,
        project:projects (
          id,
          name,
          identifier
        )
      `)
      .eq('workspace_id', workspaceId)
      .is('assignee_id', null)
      .order('created_at', { ascending: false });

    if (!error && taskData) {
      setTasks(taskData as unknown as UnassignedTask[]);
    }

    // 2. Fetch members
    const { data: memData } = await supabase
      .from('workspace_members')
      .select(`
        user_id,
        role,
        profiles:user_id (
          display_name
        )
      `)
      .eq('workspace_id', workspaceId);

    if (memData) {
      const formatted = memData.map((m: any) => ({
        user_id: m.user_id,
        role: m.role,
        display_name: m.profiles?.display_name || m.user_id.slice(0, 8),
      }));
      setMembers(formatted);
    }

    // 3. Fetch routing decisions for workspace
    const { data: routingData } = await supabase
      .from('routing_decisions')
      .select('*')
      .eq('workspace_id', workspaceId);

    if (routingData) {
      const map: Record<string, RoutingDecisionRecord> = {};
      routingData.forEach((rd: any) => {
        if (!map[rd.task_id] || new Date(rd.created_at) > new Date(map[rd.task_id].created_at)) {
          map[rd.task_id] = rd as RoutingDecisionRecord;
        }
      });
      setRoutingMap(map);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchUnassigned();
  }, [workspaceId]);

  const handleAssignTask = async (taskId: string, targetUserId: string) => {
    if (!targetUserId) return;
    setAssigningId(taskId);
    const supabase = createClient();

    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          assignee_id: targetUserId,
          status: 'Todo',
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);

      if (!error) {
        // Record activity
        if (user) {
          await supabase.from('activity_events').insert({
            workspace_id: workspaceId,
            actor_id: user.id,
            entity_type: 'task',
            entity_id: taskId,
            event_type: 'assigned',
            metadata: {
              assigned_to: targetUserId,
              source: 'incoming_triage',
            },
          });
        }

        const assignedMember = members.find((m) => m.user_id === targetUserId);
        setNotification(`Task assigned to ${assignedMember?.display_name || 'member'}`);
        setTimeout(() => setNotification(null), 3000);
        fetchUnassigned();
      }
    } catch (err) {
      console.error('Assignment error:', err);
    } finally {
      setAssigningId(null);
    }
  };

  const handlePriorityUpdate = async (taskId: string, newPriority: TaskPriority) => {
    const supabase = createClient();
    await supabase.from('tasks').update({ priority: newPriority }).eq('id', taskId);
    fetchUnassigned();
  };

  const isTriageAuthorized = role === 'admin' || role === 'lead';

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#23170E] flex items-center gap-2">
              <Clock className="h-7 w-7 text-[#D68B1C]" /> Incoming Triage Inbox
            </h1>
            <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-[#FCF3E3] text-[#824B04] border border-[#F1DCBA]">
              {tasks.length} Unassigned
            </span>
          </div>
          <p className="text-xs text-[#6E5D4E] mt-1">
            Incoming tasks requiring team lead prioritization, routing, and explicit member assignment.
          </p>
        </div>

        {notification && (
          <div className="p-2.5 rounded-xl bg-[#ECF6E3] border border-[#D4E9C1] text-[#2B5910] text-xs flex items-center gap-2 animate-in fade-in shadow-2xs">
            <CheckCircle2 className="h-4 w-4 text-[#4F8E27]" /> {notification}
          </div>
        )}
      </div>

      {/* Source Filter Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-full bg-[#F2ECE1] border border-[#E3DAC8] w-fit text-xs">
        {[
          { id: 'all', label: `All (${tasks.length})` },
          { id: 'slack', label: `Slack Intake (${tasks.filter((t) => t.source === 'slack').length})` },
          { id: 'manual', label: `Manual (${tasks.filter((t) => t.source !== 'slack').length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSourceFilter(tab.id as any)}
            className={`px-3.5 py-1.5 rounded-full font-medium transition-colors ${
              sourceFilter === tab.id
                ? 'bg-[#FAF7F2] text-[#23170E] font-semibold shadow-2xs'
                : 'text-[#736251] hover:text-[#23170E]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-[#736251] gap-2 font-mono text-xs">
          <Loader2 className="h-5 w-5 animate-spin text-[#D68B1C]" />
          <span>Scanning incoming task queue...</span>
        </div>
      ) : tasks.filter((t) => sourceFilter === 'all' || (sourceFilter === 'slack' ? t.source === 'slack' : t.source !== 'slack')).length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 rounded-3xl border border-dashed border-[#E3DAC8] bg-[#FAF7F2] text-center space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-[#ECF6E3] text-[#4F8E27] flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-[#23170E]">All incoming tasks triaged</h3>
            <p className="text-xs text-[#6E5D4E] max-w-sm">
              There are zero unassigned items in this workspace. Any newly arriving tasks from Slack, autonomous agents,
              or the dashboard will appear here.
            </p>
          </div>
          <button
            onClick={() => setIsCreateTaskOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#DC6E26] hover:bg-[#C05617] text-white text-xs font-semibold shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" /> Submit Task for Triage
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks
            .filter(
              (t) =>
                sourceFilter === 'all' ||
                (sourceFilter === 'slack' ? t.source === 'slack' : t.source !== 'slack')
            )
            .map((task) => (
              <div
                key={task.id}
                className="p-5 rounded-2xl border border-[#E3DAC8] bg-[#FAF7F2] hover:border-[#DC6E26]/60 transition-all space-y-4 shadow-2xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-[#F2ECE1] text-[#DC6E26] border border-[#E4DBC9]">
                        {task.project?.identifier}-{task.task_number}
                      </span>
                      <span className="text-xs text-[#6E5D4E] font-medium">
                        Project: {task.project?.name || 'Project'}
                      </span>
                      {task.source === 'slack' ? (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#FBECE1] text-[#9A410D] border border-[#F3D5BE] flex items-center gap-1 font-semibold">
                          <MessageSquare className="h-3 w-3" /> Slack Origin
                          {task.slack_channel_id && ` (${task.slack_channel_id})`}
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#EFE9DF] text-[#736251]">
                          Source: {task.source}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-semibold text-[#23170E]">{task.title}</h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#6E5D4E]">Priority:</span>
                    <select
                      value={task.priority}
                      disabled={!isTriageAuthorized}
                      onChange={(e) => handlePriorityUpdate(task.id, e.target.value as TaskPriority)}
                      className="bg-[#F3EEE5] border border-[#E3DAC8] rounded-xl px-2.5 py-1 text-xs text-[#23170E] focus:outline-none focus:border-[#DC6E26] font-medium"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                {task.description && (
                  <p className="text-xs text-[#23170E] leading-relaxed bg-[#F2ECE1]/60 p-3.5 rounded-xl border border-[#E4DBC9]">
                    {task.description}
                  </p>
                )}

                {/* Agent Routing Recommendation / Lead Flag */}
                {(() => {
                  const decision = routingMap[task.id];
                  if (!decision) return null;

                  const recommendedMember = decision.proposed_assignee_id
                    ? members.find((m) => m.user_id === decision.proposed_assignee_id)
                    : null;

                  if (recommendedMember) {
                    return (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#FBECE1]/60 border border-[#F3D5BE] text-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-8 w-8 rounded-xl bg-[#FBECE1] border border-[#F3D5BE] flex items-center justify-center text-[#DC6E26] shrink-0">
                            <Bot className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-[#23170E]">
                                Agent Recommends: <span className="text-[#DC6E26] font-bold">{recommendedMember.display_name}</span> ({recommendedMember.role})
                              </span>
                              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-[#F3D5BE] text-[#752F07] font-semibold">
                                {decision.decision_method.replace(/_/g, ' ')}
                              </span>
                            </div>
                            {decision.rationale && (
                              <p className="text-[11px] text-[#6E5D4E] truncate max-w-xl font-sans">
                                {decision.rationale}
                              </p>
                            )}
                          </div>
                        </div>

                        {isTriageAuthorized && (
                          <button
                            onClick={() => handleAssignTask(task.id, recommendedMember.user_id)}
                            disabled={assigningId === task.id}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#DC6E26] hover:bg-[#C05617] text-white font-semibold text-xs whitespace-nowrap shadow-xs shrink-0 transition-colors"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Accept &amp; Assign
                          </button>
                        )}
                      </div>
                    );
                  }

                  if (decision.human_intervention_needed) {
                    return (
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-[#FCF3E3] border border-[#F1DCBA] text-xs text-[#824B04]">
                        <AlertCircle className="h-4 w-4 text-[#D68B1C] shrink-0" />
                        <span>
                          <strong className="text-[#633802]">Routing Agent Flag:</strong> {decision.rationale || 'Ambiguous destination; requires team lead triage.'}
                        </span>
                      </div>
                    );
                  }

                  return null;
                })()}

                {/* Triage Action Row */}
                <div className="pt-3 border-t border-[#E4DBC9]/70 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3 text-[#736251] text-[11px] font-mono">
                    <span>Created {new Date(task.created_at).toLocaleDateString()}</span>
                    {task.due_date && <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>}
                  </div>

                  {isTriageAuthorized ? (
                    <div className="flex items-center gap-2">
                      {user && (
                        <button
                          onClick={() => handleAssignTask(task.id, user.id)}
                          disabled={assigningId === task.id}
                          className="px-3.5 py-1.5 rounded-full border border-[#E3DAC8] bg-[#F2ECE1] hover:bg-[#EFE9DF] text-[#23170E] font-semibold text-xs transition-colors"
                        >
                          Assign to Me
                        </button>
                      )}

                      <div className="flex items-center gap-1.5">
                        <select
                          defaultValue=""
                          disabled={assigningId === task.id}
                          onChange={(e) => handleAssignTask(task.id, e.target.value)}
                          className="bg-[#F3EEE5] border border-[#E3DAC8] rounded-xl px-3 py-1.5 text-xs text-[#23170E] focus:outline-none focus:border-[#DC6E26] font-medium"
                        >
                          <option value="" disabled>
                            Assign to Member...
                          </option>
                          {members.map((m) => (
                            <option key={m.user_id} value={m.user_id}>
                              {m.display_name} ({m.role})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ) : (
                    <span className="text-[11px] text-[#736251] italic">
                      Awaiting Team Lead or Administrator assignment
                    </span>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
