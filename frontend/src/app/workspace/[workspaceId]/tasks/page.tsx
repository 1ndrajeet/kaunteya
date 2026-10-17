'use client';

import React, { useState, useEffect, use } from 'react';
import {
  CheckSquare,
  Columns3,
  List,
  Plus,
  Search,
  Filter,
  User,
  AlertCircle,
  Calendar,
  Layers,
  Clock,
  ArrowUpDown,
  Tag,
  Loader2,
} from '@/components/ui/pica-icons';
import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/features/workspace/workspace-context';
import { TaskDetailDrawer, TaskDetailData } from '@/features/tasks/task-detail-drawer';
import type { TaskPriority, TaskStatus } from '@/types/database';

const STATUS_COLUMNS: TaskStatus[] = [
  'Backlog',
  'Todo',
  'In Progress',
  'In Review',
  'Blocked',
  'Done',
];

export default function WorkspaceTasksPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const unwrappedParams = use(params);
  const workspaceId = unwrappedParams.workspaceId;
  const { role, user, setIsCreateTaskOpen } = useWorkspace();

  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [tasks, setTasks] = useState<TaskDetailData[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string; identifier: string }[]>([]);
  const [members, setMembers] = useState<{ user_id: string; role: string; display_name: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');

  // Selected task for drawer
  const [selectedTask, setSelectedTask] = useState<TaskDetailData | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  const fetchTasks = async () => {
    setLoading(true);
    const supabase = createClient();

    // 1. Fetch tasks with project & assignee relations
    const { data: taskData, error: taskError } = await supabase
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
      .order('created_at', { ascending: false });

    if (!taskError && taskData) {
      setTasks(taskData as unknown as TaskDetailData[]);
    }

    // 2. Fetch projects for filter
    const { data: projData } = await supabase
      .from('projects')
      .select('id, name, identifier')
      .eq('workspace_id', workspaceId)
      .order('name');

    if (projData) setProjects(projData);

    // 3. Fetch workspace members for filter & drawer
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
    fetchTasks();
  }, [workspaceId]);

  // Filter tasks in memory
  const filteredTasks = tasks.filter((task) => {
    // Search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const identifier = `${task.project?.identifier || ''}-${task.task_number}`.toLowerCase();
      const titleMatch = task.title.toLowerCase().includes(query);
      const descMatch = (task.description || '').toLowerCase().includes(query);
      if (!identifier.includes(query) && !titleMatch && !descMatch) {
        return false;
      }
    }

    // Project filter
    if (filterProject !== 'all' && task.project_id !== filterProject) {
      return false;
    }

    // Status filter
    if (filterStatus !== 'all' && task.status !== filterStatus) {
      return false;
    }

    // Priority filter
    if (filterPriority !== 'all' && task.priority !== filterPriority) {
      return false;
    }

    // Assignee filter
    if (filterAssignee === 'unassigned') {
      if (task.assignee_id !== null) return false;
    } else if (filterAssignee !== 'all') {
      if (task.assignee_id !== filterAssignee) return false;
    }

    return true;
  });

  const openTask = (task: TaskDetailData) => {
    setSelectedTask(task);
    setIsDrawerOpen(true);
  };

  const getPriorityBadgeClass = (p: TaskPriority) => {
    switch (p) {
      case 'Urgent':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
      case 'High':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'Medium':
        return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30';
      case 'Low':
        return 'text-zinc-400 bg-zinc-800 border-zinc-700';
    }
  };

  const getStatusBadgeClass = (s: TaskStatus) => {
    switch (s) {
      case 'Done':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'In Progress':
        return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30';
      case 'In Review':
        return 'text-violet-400 bg-violet-500/10 border-violet-500/30';
      case 'Blocked':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
      default:
        return 'text-zinc-400 bg-zinc-800 border-zinc-700';
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2.5">
            <CheckSquare className="h-6 w-6 text-indigo-400" /> Tasks
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Canonical task center &bull; Persistent across Kanban board and table views.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center p-0.5 rounded-lg border border-zinc-800 bg-zinc-900 text-xs font-medium">
            <button
              onClick={() => setViewMode('board')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                viewMode === 'board' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Columns3 className="h-3.5 w-3.5" /> Board
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                viewMode === 'list' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <List className="h-3.5 w-3.5" /> List
            </button>
          </div>

          {/* New Task Action */}
          <button
            onClick={() => setIsCreateTaskOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-sm shadow-indigo-600/30"
          >
            <Plus className="h-4 w-4" /> New Task
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-md flex flex-wrap items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search tasks by identifier (WEB-1) or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Project Filter */}
        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          className="bg-zinc-950 border border-zinc-800/80 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500"
        >
          <option value="all">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              [{p.identifier}] {p.name}
            </option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-zinc-950 border border-zinc-800/80 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500"
        >
          <option value="all">All Statuses</option>
          {STATUS_COLUMNS.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
          <option value="Cancelled">Cancelled</option>
        </select>

        {/* Priority Filter */}
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="bg-zinc-950 border border-zinc-800/80 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500"
        >
          <option value="all">All Priorities</option>
          <option value="Urgent">Urgent</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>

        {/* Assignee Filter */}
        <select
          value={filterAssignee}
          onChange={(e) => setFilterAssignee(e.target.value)}
          className="bg-zinc-950 border border-zinc-800/80 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500"
        >
          <option value="all">All Assignees</option>
          <option value="unassigned">Unassigned (Inbox)</option>
          {members.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.display_name}
            </option>
          ))}
        </select>

        <span className="text-[11px] font-mono text-zinc-500 ml-auto">
          {filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'}
        </span>
      </div>

      {/* Main Task View */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-zinc-500 gap-2 font-mono text-xs">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
          <span>Synchronizing tasks with Supabase...</span>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/20 text-center space-y-3">
          <div className="h-10 w-10 rounded-xl bg-zinc-800/60 text-zinc-400 flex items-center justify-center mx-auto">
            <CheckSquare className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-zinc-200">No matching tasks found</h3>
            <p className="text-xs text-zinc-500 max-w-sm">
              Adjust your search filters or create a new task for your team.
            </p>
          </div>
          <button
            onClick={() => setIsCreateTaskOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
          >
            <Plus className="h-3.5 w-3.5" /> Create Task
          </button>
        </div>
      ) : viewMode === 'board' ? (
        /* ================= KANBAN BOARD VIEW ================= */
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3.5 items-start overflow-x-auto pb-6">
          {STATUS_COLUMNS.map((colStatus) => {
            const colTasks = filteredTasks.filter((t) => t.status === colStatus);
            return (
              <div
                key={colStatus}
                className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3 space-y-3 flex flex-col min-h-[300px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60">
                  <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    {colStatus}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-semibold">
                    {colTasks.length}
                  </span>
                </div>

                {/* Column Task Cards */}
                <div className="space-y-2 flex-1">
                  {colTasks.length === 0 ? (
                    <div className="h-20 rounded-lg border border-dashed border-zinc-800/60 flex items-center justify-center text-[11px] text-zinc-600 font-mono">
                      Empty
                    </div>
                  ) : (
                    colTasks.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => openTask(t)}
                        className="group p-3 rounded-lg border border-zinc-800 bg-zinc-900/90 hover:border-indigo-500/50 hover:bg-zinc-800/80 transition-all cursor-pointer shadow-sm space-y-2"
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-indigo-400 font-semibold">
                            {t.project?.identifier}-{t.task_number}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded border text-[9px] font-semibold ${getPriorityBadgeClass(
                              t.priority
                            )}`}
                          >
                            {t.priority}
                          </span>
                        </div>

                        <p className="text-xs font-medium text-zinc-200 line-clamp-2 leading-snug group-hover:text-white">
                          {t.title}
                        </p>

                        <div className="pt-1.5 border-t border-zinc-800/60 flex items-center justify-between text-[10px] text-zinc-500">
                          <div className="flex items-center gap-1">
                            {t.assignee ? (
                              <span className="text-zinc-300 font-medium truncate max-w-[90px]">
                                {t.assignee.display_name}
                              </span>
                            ) : (
                              <span className="text-amber-400/80 font-mono">Unassigned</span>
                            )}
                          </div>
                          {t.due_date && (
                            <span className="font-mono text-zinc-400 flex items-center gap-1">
                              <Calendar className="h-2.5 w-2.5" />
                              {new Date(t.due_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ================= LIST / TABLE VIEW ================= */
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/80 text-zinc-400 font-medium uppercase tracking-wider text-[10px] border-b border-zinc-800">
                <tr>
                  <th className="py-3 px-4">Identifier</th>
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Assignee</th>
                  <th className="py-3 px-4">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                {filteredTasks.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => openTask(t)}
                    className="hover:bg-zinc-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-4 font-mono font-semibold text-indigo-400 whitespace-nowrap">
                      {t.project?.identifier}-{t.task_number}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-zinc-100 max-w-xs truncate">
                      {t.title}
                    </td>
                    <td className="py-2.5 px-4 text-zinc-400 whitespace-nowrap">
                      {t.project?.name || 'Project'}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${getStatusBadgeClass(
                          t.status
                        )}`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border ${getPriorityBadgeClass(
                          t.priority
                        )}`}
                      >
                        {t.priority}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      {t.assignee ? (
                        <span className="text-zinc-200 font-medium">{t.assignee.display_name}</span>
                      ) : (
                        <span className="text-amber-400/80 font-mono text-[11px]">Unassigned</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-zinc-400 font-mono text-[11px] whitespace-nowrap">
                      {t.due_date ? new Date(t.due_date).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Task Detail Drawer Slide-over */}
      <TaskDetailDrawer
        task={selectedTask}
        workspaceId={workspaceId}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onTaskUpdated={fetchTasks}
        members={members}
        currentUserId={user?.id ?? null}
        userRole={role}
      />
    </div>
  );
}
