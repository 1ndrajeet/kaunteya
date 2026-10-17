'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  CheckSquare,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle2,
  GitBranch,
  Layers,
  ArrowRight,
  Plus,
  Loader2,
} from '@/components/ui/pica-icons';
import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/features/workspace/workspace-context';
import { TaskDetailDrawer, TaskDetailData } from '@/features/tasks/task-detail-drawer';
import type { TaskStatus } from '@/types/database';

export default function MemberPortalPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const unwrappedParams = use(params);
  const workspaceId = unwrappedParams.workspaceId;
  const { user, role, setIsCreateTaskOpen } = useWorkspace();

  const [myTasks, setMyTasks] = useState<TaskDetailData[]>([]);
  const [members, setMembers] = useState<{ user_id: string; role: string; display_name: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'in_progress' | 'due_soon' | 'done'>('in_progress');

  // Drawer
  const [selectedTask, setSelectedTask] = useState<TaskDetailData | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  const fetchMyTasks = async () => {
    if (!user) return;
    setLoading(true);
    const supabase = createClient();

    // Fetch tasks assigned to the current user
    const { data: taskData, error } = await supabase
      .from('tasks')
      .select(`
        id,
        workspace_id,
        project_id,
        task_number,
        title,
        description,
        status,
        priority,
        assignee_id,
        created_by,
        due_date,
        source,
        assignment_type,
        team_id,
        status_reason,
        status_changed_by,
        status_changed_at,
        created_at,
        updated_at,
        project:projects (
          id,
          name,
          identifier
        ),
        assignee:profiles!tasks_assignee_id_fkey (
          id,
          display_name,
          avatar_url
        )
      `)
      .eq('workspace_id', workspaceId)
      .eq('assignee_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && taskData) {
      setMyTasks(taskData as unknown as TaskDetailData[]);
    }

    // Fetch members for drawer
    const { data: memData } = await supabase
      .from('workspace_members')
      .select(`
        user_id,
        role,
        profiles:user_id ( display_name )
      `)
      .eq('workspace_id', workspaceId);

    if (memData) {
      setMembers(
        memData.map((m: any) => ({
          user_id: m.user_id,
          role: m.role,
          display_name: m.profiles?.display_name || m.user_id.slice(0, 8),
        }))
      );
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchMyTasks();
  }, [workspaceId, user]);

  const [inThreeDays, setInThreeDays] = useState<string>('');
  useEffect(() => {
    setInThreeDays(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  }, []);

  const inProgressTasks = myTasks.filter((t) => t.status === 'In Progress' || t.status === 'Todo');
  const dueSoonTasks = myTasks.filter(
    (t) => t.due_date && t.due_date <= inThreeDays && t.status !== 'Done'
  );
  const completedTasks = myTasks.filter((t) => t.status === 'Done');

  const displayedTasks =
    activeFilter === 'in_progress'
      ? inProgressTasks
      : activeFilter === 'due_soon'
      ? dueSoonTasks
      : activeFilter === 'done'
      ? completedTasks
      : myTasks;

  const handleQuickStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    const supabase = createClient();
    await supabase
      .from('tasks')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', taskId);

    if (user) {
      await supabase.from('activity_events').insert({
        workspace_id: workspaceId,
        actor_id: user.id,
        entity_type: 'task',
        entity_id: taskId,
        event_type: 'status_changed',
        metadata: { status: newStatus },
      });
    }

    fetchMyTasks();
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <CheckSquare className="h-6 w-6 text-emerald-400" /> My Tasks
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Your personal focus area &bull; Update status, record progress notes, and link commits.
          </p>
        </div>

        <button
          onClick={() => setIsCreateTaskOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" /> New Task
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <button
          onClick={() => setActiveFilter('in_progress')}
          className={`p-4 rounded-xl border text-left transition-all ${
            activeFilter === 'in_progress'
              ? 'border-indigo-500/80 bg-zinc-900 shadow-md shadow-indigo-950/20'
              : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
          }`}
        >
          <span className="text-xs font-medium text-indigo-400">In Progress / Todo</span>
          <div className="text-2xl font-bold text-zinc-100 mt-1">{inProgressTasks.length}</div>
          <span className="text-[10px] text-zinc-500 font-mono">Active commitments</span>
        </button>

        <button
          onClick={() => setActiveFilter('due_soon')}
          className={`p-4 rounded-xl border text-left transition-all ${
            activeFilter === 'due_soon'
              ? 'border-amber-500/80 bg-zinc-900 shadow-md shadow-amber-950/20'
              : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
          }`}
        >
          <span className="text-xs font-medium text-amber-400">Due Soon (&le;3 days)</span>
          <div className="text-2xl font-bold text-amber-400 mt-1">{dueSoonTasks.length}</div>
          <span className="text-[10px] text-zinc-500 font-mono">Upcoming deadlines</span>
        </button>

        <button
          onClick={() => setActiveFilter('done')}
          className={`p-4 rounded-xl border text-left transition-all ${
            activeFilter === 'done'
              ? 'border-emerald-500/80 bg-zinc-900 shadow-md shadow-emerald-950/20'
              : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
          }`}
        >
          <span className="text-xs font-medium text-emerald-400">Completed</span>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{completedTasks.length}</div>
          <span className="text-[10px] text-zinc-500 font-mono">Finished work</span>
        </button>

        <button
          onClick={() => setActiveFilter('all')}
          className={`p-4 rounded-xl border text-left transition-all ${
            activeFilter === 'all'
              ? 'border-zinc-600 bg-zinc-900 shadow-md'
              : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
          }`}
        >
          <span className="text-xs font-medium text-zinc-400">Total Assigned</span>
          <div className="text-2xl font-bold text-zinc-200 mt-1">{myTasks.length}</div>
          <span className="text-[10px] text-zinc-500 font-mono">All-time assignments</span>
        </button>
      </div>

      {/* Task List */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
          <h2 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
            {activeFilter === 'in_progress'
              ? 'Active Tasks'
              : activeFilter === 'due_soon'
              ? 'Approaching Deadlines'
              : activeFilter === 'done'
              ? 'Completed Tasks'
              : 'All Assigned Tasks'}{' '}
            ({displayedTasks.length})
          </h2>
          <span className="text-[11px] font-mono text-zinc-500">Click to inspect and comment</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-zinc-500 font-mono text-xs flex flex-col items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
            <span>Loading your tasks...</span>
          </div>
        ) : displayedTasks.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 font-mono text-xs border border-dashed border-zinc-800 rounded-lg">
            No tasks found in this view.
          </div>
        ) : (
          <div className="space-y-2.5">
            {displayedTasks.map((task) => (
              <div
                key={task.id}
                onClick={() => {
                  setSelectedTask(task);
                  setIsDrawerOpen(true);
                }}
                className="group p-4 rounded-xl border border-zinc-800 bg-zinc-950/70 hover:border-indigo-500/50 hover:bg-zinc-900/60 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-indigo-400">
                      {task.project?.identifier}-{task.task_number}
                    </span>
                    <span className="text-xs text-zinc-400 font-medium">{task.project?.name}</span>
                    <span
                      className={`text-[9px] font-semibold px-1.5 py-0.2 rounded border uppercase ${
                        task.priority === 'Urgent'
                          ? 'text-rose-400 border-rose-500/30 bg-rose-500/10'
                          : task.priority === 'High'
                          ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                          : 'text-zinc-400 border-zinc-700 bg-zinc-800'
                      }`}
                    >
                      {task.priority}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-zinc-200 group-hover:text-white transition-colors">
                    {task.title}
                  </h3>
                  {task.description && (
                    <p className="text-xs text-zinc-400 line-clamp-1 max-w-xl">{task.description}</p>
                  )}
                </div>

                {/* Right controls: Quick status change */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-3 shrink-0 text-xs"
                >
                  {task.due_date && (
                    <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(task.due_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  )}

                  <select
                    value={task.status}
                    onChange={(e) => handleQuickStatusChange(task.id, e.target.value as TaskStatus)}
                    className="bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 font-medium"
                  >
                    <option value="Todo">Todo</option>
                    <option value="In Progress">In Progress</option>
                    <option value="In Review">In Review</option>
                    <option value="Blocked">Blocked</option>
                    <option value="Done">Done</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Task Drawer */}
      <TaskDetailDrawer
        task={selectedTask}
        workspaceId={workspaceId}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onTaskUpdated={fetchMyTasks}
        members={members}
        currentUserId={user?.id ?? null}
        userRole={role}
      />
    </div>
  );
}
