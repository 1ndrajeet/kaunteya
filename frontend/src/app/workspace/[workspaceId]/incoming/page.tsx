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
  Sparkles,
  Loader2,
  Plus,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/features/workspace/workspace-context';
import type { TaskPriority, TaskStatus } from '@/types/database';

interface UnassignedTask {
  id: string;
  task_number: number;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  source: string;
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
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
              <Clock className="h-6 w-6 text-amber-400" /> Incoming Triage Inbox
            </h1>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {tasks.length} Unassigned
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Incoming tasks requiring team lead prioritization, routing, and explicit member assignment.
          </p>
        </div>

        {notification && (
          <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" /> {notification}
          </div>
        )}
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-zinc-500 gap-2 font-mono text-xs">
          <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
          <span>Scanning incoming task queue...</span>
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/20 text-center space-y-3">
          <div className="h-12 w-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-zinc-100">All incoming tasks triaged</h3>
            <p className="text-xs text-zinc-400 max-w-sm">
              There are zero unassigned items in this workspace. Any newly arriving tasks from Slack, autonomous agents,
              or the dashboard will appear here.
            </p>
          </div>
          <button
            onClick={() => setIsCreateTaskOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
          >
            <Plus className="h-3.5 w-3.5" /> Submit Task for Triage
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 transition-all space-y-4 shadow-sm"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-zinc-800 text-indigo-400 border border-zinc-700">
                      {task.project?.identifier}-{task.task_number}
                    </span>
                    <span className="text-xs text-zinc-400 font-medium">
                      Project: {task.project?.name || 'Project'}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                      Source: {task.source}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-zinc-100">{task.title}</h3>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400">Priority:</span>
                  <select
                    value={task.priority}
                    disabled={!isTriageAuthorized}
                    onChange={(e) => handlePriorityUpdate(task.id, e.target.value as TaskPriority)}
                    className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 font-medium"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {task.description && (
                <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950/40 p-3 rounded-lg border border-zinc-800/60">
                  {task.description}
                </p>
              )}

              {/* Triage Action Row */}
              <div className="pt-3 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3 text-zinc-500 text-[11px] font-mono">
                  <span>Created {new Date(task.created_at).toLocaleDateString()}</span>
                  {task.due_date && <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>}
                </div>

                {isTriageAuthorized ? (
                  <div className="flex items-center gap-2">
                    {user && (
                      <button
                        onClick={() => handleAssignTask(task.id, user.id)}
                        disabled={assigningId === task.id}
                        className="px-3 py-1.5 rounded-lg border border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 font-medium text-xs transition-colors"
                      >
                        Assign to Me
                      </button>
                    )}

                    <div className="flex items-center gap-1.5">
                      <select
                        defaultValue=""
                        disabled={assigningId === task.id}
                        onChange={(e) => handleAssignTask(task.id, e.target.value)}
                        className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 font-medium"
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
                  <span className="text-[11px] text-zinc-500 italic">
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
