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

      // Fetch ALL active AND planning projects (not just 'active')
      const { data: projData } = await supabase
        .from('projects')
        .select('id, name, identifier, status')
        .eq('workspace_id', workspaceId)
        .in('status', ['planning', 'active', 'at_risk'])
        .order('name');

      if (projData) {
        setProjects(projData);
        // Only auto-select if not already set and no default was provided
        if (!defaultProjectId) {
          if (projData.length === 1) {
            setProjectId(projData[0].id);
          } else if (projData.length > 0 && !projectId) {
            setProjectId(projData[0].id);
          }
        } else {
          setProjectId(defaultProjectId);
        }
      } else {
        setProjects([]);
      }

      // Fetch members
      const { data: memData } = await supabase
        .from('workspace_members')
        .select(`user_id, role, profiles:user_id ( display_name )`)
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
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, workspaceId, defaultProjectId]);

  // Load project teams when project changes
  useEffect(() => {
    if (!projectId) {
      setProjectTeams([]);
      setTeamId('');
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
        setTeamId(data[0]?.id || '');
      } else {
        setProjectTeams([]);
        setTeamId('');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#23170E]/50 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-lg rounded-3xl border border-[#E3DAC8] bg-[#FAF7F2] shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#E3DAC8] flex items-center justify-between bg-[#F2ECE1]">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-[#FBECE1] text-[#DC6E26] border border-[#F3D5BE] flex items-center justify-center">
              <Plus className="h-4 w-4" />
            </div>
            <h3 className="font-serif text-lg font-bold text-[#23170E]">Create New Task</h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#736251] hover:text-[#23170E] p-1.5 rounded-lg hover:bg-[#E4DBC9] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3.5 rounded-xl border border-[#F4CFC8] bg-[#FCECE9] text-[#B33624] text-xs flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-[#B33624] shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Project Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#23170E]">Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              required
              className="w-full bg-[#F3EEE5] border border-[#E3DAC8] rounded-xl px-3 py-2 text-xs text-[#23170E] focus:outline-none focus:border-[#DC6E26]"
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
            <label className="text-xs font-medium text-[#23170E]">Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Implement GitHub OAuth state verification"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#F3EEE5] border border-[#E3DAC8] rounded-xl px-3.5 py-2 text-sm text-[#23170E] placeholder:text-[#93826F] focus:outline-none focus:border-[#DC6E26] focus:ring-1 focus:ring-[#DC6E26]"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#23170E]">Description</label>
            <textarea
              rows={3}
              placeholder="Add acceptance criteria, technical context, or links..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#F3EEE5] border border-[#E3DAC8] rounded-xl p-3 text-xs text-[#23170E] placeholder:text-[#93826F] focus:outline-none focus:border-[#DC6E26] focus:ring-1 focus:ring-[#DC6E26] resize-none"
            />
          </div>

          {/* Meta Controls Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* Status */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[#6E5D4E]">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full bg-[#F3EEE5] border border-[#E3DAC8] rounded-xl px-2.5 py-1.5 text-xs text-[#23170E] focus:outline-none focus:border-[#DC6E26]"
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
              <label className="text-[11px] font-medium text-[#6E5D4E]">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full bg-[#F3EEE5] border border-[#E3DAC8] rounded-xl px-2.5 py-1.5 text-xs text-[#23170E] focus:outline-none focus:border-[#DC6E26]"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>

            {/* Assignee / Team Scope */}
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <label className="text-[11px] font-medium text-[#6E5D4E]">Assignment Scope</label>
              <div className="flex rounded-lg bg-[#F2ECE1] border border-[#E3DAC8] p-0.5 text-[10px] font-medium mb-1">
                <button
                  type="button"
                  onClick={() => setAssignmentType('individual')}
                  className={`flex-1 py-1 rounded-md transition-colors ${
                    assignmentType === 'individual'
                      ? 'bg-[#FAF7F2] text-[#23170E] font-semibold shadow-2xs'
                      : 'text-[#736251] hover:text-[#23170E]'
                  }`}
                >
                  Member
                </button>
                <button
                  type="button"
                  onClick={() => setAssignmentType('team')}
                  className={`flex-1 py-1 rounded-md transition-colors ${
                    assignmentType === 'team'
                      ? 'bg-[#FAF7F2] text-[#23170E] font-semibold shadow-2xs'
                      : 'text-[#736251] hover:text-[#23170E]'
                  }`}
                >
                  Team
                </button>
              </div>

              {assignmentType === 'individual' ? (
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full bg-[#F3EEE5] border border-[#E3DAC8] rounded-xl px-2.5 py-1.5 text-xs text-[#23170E] focus:outline-none focus:border-[#DC6E26]"
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
                  className="w-full bg-[#F3EEE5] border border-[#E3DAC8] rounded-xl px-2.5 py-1.5 text-xs text-[#23170E] focus:outline-none focus:border-[#DC6E26]"
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
            <label className="text-[11px] font-medium text-[#6E5D4E] flex items-center gap-1.5">
              <Calendar className="h-3 w-3 text-[#DC6E26]" /> Due Date (Optional)
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-[#F3EEE5] border border-[#E3DAC8] rounded-xl px-3 py-1.5 text-xs text-[#23170E] focus:outline-none focus:border-[#DC6E26]"
            />
          </div>

          {/* Form Actions */}
          <div className="pt-3 border-t border-[#E3DAC8] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-full border border-[#E3DAC8] text-xs font-semibold text-[#736251] hover:text-[#23170E] hover:bg-[#EFE9DF] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || projects.length === 0}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-[#DC6E26] hover:bg-[#C05617] text-white text-xs font-semibold transition-colors shadow-xs disabled:opacity-50"
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
