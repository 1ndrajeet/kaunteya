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
  Trash2,
  Tag,
  Loader2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { TaskPriority, TaskStatus } from '@/types/database';

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
  }, [task]);

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
            <p className="text-[11px] text-zinc-500 font-mono">
              Created {new Date(task.created_at).toLocaleDateString()} &bull; Source: {task.source}
            </p>
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
                  setStatus(val);
                  handleFieldUpdate('status', val);
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
      </div>
    </div>
  );
}
