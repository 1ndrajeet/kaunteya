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
        return 'text-[#B33624] bg-[#FCECE9] border-[#F4CFC8]';
      case 'High':
        return 'text-[#D68B1C] bg-[#FCF3E3] border-[#F1DCBA]';
      case 'Medium':
        return 'text-[#DC6E26] bg-[#FBECE1] border-[#E8B894]';
      case 'Low':
        return 'text-[#736251] bg-[#EFE9DF] border-[#E3DAC8]';
    }
  };

  const getStatusBadgeClass = (s: TaskStatus) => {
    switch (s) {
      case 'Done':
        return 'text-[#4F8E27] bg-[#ECF6E3] border-[#D4E9C1]';
      case 'In Progress':
        return 'text-[#DC6E26] bg-[#FBECE1] border-[#E8B894]';
      case 'In Review':
        return 'text-[#824B23] bg-[#F5ECE4] border-[#E6D3C3]';
      case 'Blocked':
        return 'text-[#B33624] bg-[#FCECE9] border-[#F4CFC8]';
      default:
        return 'text-[#736251] bg-[#EFE9DF] border-[#E3DAC8]';
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#23170E] flex items-center gap-2.5">
            <CheckSquare className="h-7 w-7 text-[#DC6E26]" /> Tasks
          </h1>
          <p className="text-xs text-[#6E5D4E] mt-1">
            Canonical task center &bull; Persistent across Kanban board and table views.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center p-0.5 rounded-full border border-[#E3DAC8] bg-[#F2ECE1] text-xs font-medium">
            <button
              onClick={() => setViewMode('board')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${
                viewMode === 'board'
                  ? 'bg-[#FAF7F2] text-[#23170E] shadow-2xs font-semibold'
                  : 'text-[#736251] hover:text-[#23170E]'
              }`}
            >
              <Columns3 className="h-3.5 w-3.5" /> Board
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${
                viewMode === 'list'
                  ? 'bg-[#FAF7F2] text-[#23170E] shadow-2xs font-semibold'
                  : 'text-[#736251] hover:text-[#23170E]'
              }`}
            >
              <List className="h-3.5 w-3.5" /> List
            </button>
          </div>

          {/* New Task Action */}
          <button
            onClick={() => setIsCreateTaskOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#DC6E26] hover:bg-[#C05617] text-white text-xs font-semibold transition-colors shadow-xs"
          >
            <Plus className="h-4 w-4" /> New Task
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3.5 rounded-2xl border border-[#E3DAC8] bg-[#FAF7F2] shadow-2xs flex flex-wrap items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#736251]" />
          <input
            type="text"
            placeholder="Search tasks by identifier (WEB-1) or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#F3EEE5] border border-[#E3DAC8] rounded-xl pl-9 pr-3 py-1.5 text-xs text-[#23170E] placeholder:text-[#93826F] focus:outline-none focus:border-[#DC6E26] focus:ring-1 focus:ring-[#DC6E26]"
          />
        </div>

        {/* Project Filter */}
        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          className="bg-[#F3EEE5] border border-[#E3DAC8] rounded-xl px-2.5 py-1.5 text-xs text-[#23170E] focus:outline-none focus:border-[#DC6E26]"
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
          className="bg-[#F3EEE5] border border-[#E3DAC8] rounded-xl px-2.5 py-1.5 text-xs text-[#23170E] focus:outline-none focus:border-[#DC6E26]"
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
          className="bg-[#F3EEE5] border border-[#E3DAC8] rounded-xl px-2.5 py-1.5 text-xs text-[#23170E] focus:outline-none focus:border-[#DC6E26]"
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
          className="bg-[#F3EEE5] border border-[#E3DAC8] rounded-xl px-2.5 py-1.5 text-xs text-[#23170E] focus:outline-none focus:border-[#DC6E26]"
        >
          <option value="all">All Assignees</option>
          <option value="unassigned">Unassigned (Inbox)</option>
          {members.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.display_name}
            </option>
          ))}
        </select>

        <span className="text-[11px] font-mono text-[#736251] ml-auto">
          {filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'}
        </span>
      </div>

      {/* Main Task View */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-[#736251] gap-2 font-mono text-xs">
          <Loader2 className="h-5 w-5 animate-spin text-[#DC6E26]" />
          <span>Synchronizing tasks with Supabase...</span>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 rounded-3xl border border-dashed border-[#E3DAC8] bg-[#FAF7F2] text-center space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-[#EFE9DF] text-[#736251] flex items-center justify-center mx-auto">
            <CheckSquare className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-[#23170E]">No matching tasks found</h3>
            <p className="text-xs text-[#6E5D4E] max-w-sm">
              Adjust your search filters or create a new task for your team.
            </p>
          </div>
          <button
            onClick={() => setIsCreateTaskOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#DC6E26] hover:bg-[#C05617] text-white text-xs font-semibold shadow-xs"
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
                className="rounded-2xl border border-[#E3DAC8] bg-[#F2ECE1]/70 p-3.5 space-y-3 flex flex-col min-h-[340px] shadow-2xs"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2 border-b border-[#E3DAC8]">
                  <span className="text-xs font-semibold text-[#23170E] uppercase tracking-wider flex items-center gap-1.5">
                    {colStatus}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#E4DBC9] text-[#23170E] font-bold">
                    {colTasks.length}
                  </span>
                </div>

                {/* Column Task Cards */}
                <div className="space-y-2 flex-1">
                  {colTasks.length === 0 ? (
                    <div className="h-24 rounded-xl border border-dashed border-[#E3DAC8] flex items-center justify-center text-[11px] text-[#736251] font-mono">
                      Empty
                    </div>
                  ) : (
                    colTasks.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => openTask(t)}
                        className="group p-3.5 rounded-xl border border-[#E3DAC8] bg-[#FAF7F2] hover:border-[#DC6E26]/60 hover:shadow-md transition-all cursor-pointer shadow-2xs space-y-2.5"
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-[#DC6E26] font-bold">
                            {t.project?.identifier}-{t.task_number}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full border text-[9px] font-semibold ${getPriorityBadgeClass(
                              t.priority
                            )}`}
                          >
                            {t.priority}
                          </span>
                        </div>

                        <p className="text-xs font-medium text-[#23170E] line-clamp-2 leading-snug group-hover:text-[#DC6E26] transition-colors">
                          {t.title}
                        </p>

                        <div className="pt-2 border-t border-[#E4DBC9]/60 flex items-center justify-between text-[10px] text-[#736251]">
                          <div className="flex items-center gap-1">
                            {t.assignee ? (
                              <span className="text-[#23170E] font-medium truncate max-w-[90px]">
                                {t.assignee.display_name}
                              </span>
                            ) : (
                              <span className="text-[#D68B1C] font-mono font-medium">Unassigned</span>
                            )}
                          </div>
                          {t.due_date && (
                            <span className="font-mono text-[#736251] flex items-center gap-1">
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
        <div className="rounded-2xl border border-[#E3DAC8] bg-[#FAF7F2] overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F2ECE1] text-[#736251] font-mono text-[10px] uppercase tracking-wider border-b border-[#E3DAC8]">
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
              <tbody className="divide-y divide-[#E4DBC9]/70 text-[#23170E]">
                {filteredTasks.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => openTask(t)}
                    className="hover:bg-[#F2ECE1]/60 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-[#DC6E26] whitespace-nowrap">
                      {t.project?.identifier}-{t.task_number}
                    </td>
                    <td className="py-3 px-4 font-medium text-[#23170E] max-w-xs truncate">
                      {t.title}
                    </td>
                    <td className="py-3 px-4 text-[#6E5D4E] whitespace-nowrap">
                      {t.project?.name || 'Project'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusBadgeClass(
                          t.status
                        )}`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getPriorityBadgeClass(
                          t.priority
                        )}`}
                      >
                        {t.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {t.assignee ? (
                        <span className="text-[#23170E] font-medium">{t.assignee.display_name}</span>
                      ) : (
                        <span className="text-[#D68B1C] font-mono text-[11px] font-medium">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[#736251] font-mono text-[11px] whitespace-nowrap">
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
