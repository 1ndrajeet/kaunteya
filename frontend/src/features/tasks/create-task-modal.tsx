'use client';

import React, { useState, useEffect } from 'react';
import { X, Loader2, Plus, Calendar, AlertCircle, CheckCircle2 } from '@/components/ui/pica-icons';
import { createClient } from '@/lib/supabase/client';
import type { TaskPriority, TaskStatus } from '@/types/database';

interface CreateTaskModalProps {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated?: () => void;
  defaultProjectId?: string;
  defaultAssigneeId?: string;
  defaultStatus?: TaskStatus;
}

interface ProjectOption {
  id: string;
  name: string;
  identifier: string;
}

interface MemberOption {
  user_id: string;
  role: string;
  display_name: string;
}

export function CreateTaskModal({
  workspaceId,
  isOpen,
  onClose,
  onTaskCreated,
  defaultProjectId,
  defaultAssigneeId,
  defaultStatus = 'Todo',
}: CreateTaskModalProps) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [projectId, setProjectId] = useState<string>(defaultProjectId || '');
  const [assignmentType, setAssignmentType] = useState<'individual' | 'team'>('individual');
  const [teamId, setTeamId] = useState<string>('');
  const [projectTeams, setProjectTeams] = useState<{ id: string; name: string }[]>([]);
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [status, setStatus] = useState<TaskStatus>(defaultStatus);
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [assigneeId, setAssigneeId] = useState<string>(defaultAssigneeId || '');
  const [dueDate, setDueDate] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      const supabase = createClient();

      // Fetch projects
      const { data: projData } = await supabase
        .from('projects')
        .select('id, name, identifier')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active')
        .order('name');

      if (projData && projData.length > 0) {
        setProjects(projData);
        if (!projectId && !defaultProjectId) {
          setProjectId(projData[0].id);
        }
      }

      // Fetch members
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
    };

    loadData();
  }, [isOpen, workspaceId, defaultProjectId, projectId]);

  // Load project teams when project changes
  useEffect(() => {
    if (!projectId) {
      setProjectTeams([]);
      return;
    }
    const loadTeams = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('teams')
        .select('id, name')
        .eq('project_id', projectId)
        .order('name');
      if (data) {
        setProjectTeams(data);
        if (data.length > 0 && !teamId) {
          setTeamId(data[0].id);
        }
      }
    };
    loadTeams();
  }, [projectId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !projectId) {
      setErrorMsg('Task title and target project are required.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    const supabase = createClient();

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setErrorMsg('Authentication session lost. Please log in.');
        setLoading(false);
        return;
      }

      // 1. Get next task number for this project
      const { data: numData, error: numError } = await supabase.rpc('get_next_task_number', {
        p_project_id: projectId,
      });

      const nextNum = numData || 1;

      // 2. Insert Task
      const { data: insertedTask, error: insertError } = await supabase
        .from('tasks')
        .insert({
          workspace_id: workspaceId,
          project_id: projectId,
          task_number: nextNum,
          title: title.trim(),
          description: description.trim() || null,
          status,
          priority,
          assignment_type: assignmentType,
          team_id: assignmentType === 'team' ? teamId || null : null,
          assignee_id: assignmentType === 'individual' ? assigneeId || null : null,
          created_by: session.user.id,
          due_date: dueDate || null,
          source: 'manual',
        })
        .select()
        .single();

      if (insertError) {
        setErrorMsg(insertError.message);
        setLoading(false);
        return;
      }

      // 3. Log activity event
      await supabase.from('activity_events').insert({
        workspace_id: workspaceId,
        actor_id: session.user.id,
        entity_type: 'task',
        entity_id: insertedTask.id,
        event_type: 'created',
        metadata: {
          title: insertedTask.title,
          priority: insertedTask.priority,
          status: insertedTask.status,
          assignee_id: insertedTask.assignee_id,
        },
      });

      // Reset form and close
      setTitle('');
      setDescription('');
      setAssigneeId('');
      setDueDate('');
      setLoading(false);
      onClose();
      if (onTaskCreated) onTaskCreated();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create task');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Plus className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-100">Create New Task</h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 p-1 rounded-md hover:bg-zinc-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg border border-rose-900/50 bg-rose-950/30 text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Project Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              required
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
            >
              {projects.length === 0 ? (
                <option value="">No projects available (Create one first)</option>
              ) : (
                projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.identifier}] {p.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Task Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Implement GitHub OAuth state verification"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">Description</label>
            <textarea
              rows={3}
              placeholder="Add acceptance criteria, technical context, or links..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Meta Controls Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* Status */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-zinc-400">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="Backlog">Backlog</option>
                <option value="Todo">Todo</option>
                <option value="In Progress">In Progress</option>
                <option value="In Review">In Review</option>
                <option value="Blocked">Blocked</option>
                <option value="Done">Done</option>
              </select>
            </div>

            {/* Priority */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-zinc-400">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>

            {/* Assignee / Team Scope */}
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <label className="text-[11px] font-medium text-zinc-400">Assignment Scope</label>
              <div className="flex rounded-lg bg-zinc-950 border border-zinc-800 p-0.5 text-[10px] font-medium mb-1">
                <button
                  type="button"
                  onClick={() => setAssignmentType('individual')}
                  className={`flex-1 py-1 rounded transition-colors ${
                    assignmentType === 'individual'
                      ? 'bg-zinc-800 text-zinc-100 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Member
                </button>
                <button
                  type="button"
                  onClick={() => setAssignmentType('team')}
                  className={`flex-1 py-1 rounded transition-colors ${
                    assignmentType === 'team'
                      ? 'bg-zinc-800 text-zinc-100 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Team
                </button>
              </div>

              {assignmentType === 'individual' ? (
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">(Unassigned / Triage)</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.display_name} ({m.role})
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">(No specific team)</option>
                  {projectTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Due Date */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-zinc-400 flex items-center gap-1.5">
              <Calendar className="h-3 w-3" /> Due Date (Optional)
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Form Actions */}
          <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3.5 py-2 rounded-lg border border-zinc-800 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || projects.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-sm shadow-indigo-600/30 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating...
                </>
              ) : (
                'Create Task'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
