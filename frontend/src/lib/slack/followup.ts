import { createServiceClient } from '@/lib/supabase/service';
import { getSlackWebClient, sendFollowupMessage, sendStatusUpdatedConfirmation } from './client';
import { parseSlackMessage } from './parser';
import type { TaskStatus } from '@/types/database';

export interface FollowupRunSummary {
  workspaceId: string;
  slackTeamId: string;
  tasksEvaluated: number;
  followupsSent: number;
  skippedRecent: number;
  unmappedAssignees: number;
  errors: string[];
}

/**
 * Sweeps workspaces for eligible open tasks and sends automated follow-ups
 * to mapped assignees.
 */
export async function evaluateAndDispatchFollowups(
  targetWorkspaceId?: string
): Promise<FollowupRunSummary[]> {
  const supabase = createServiceClient();
  const summaries: FollowupRunSummary[] = [];

  // 1. Fetch active installations
  let query = supabase
    .from('slack_installations')
    .select(`
      id,
      workspace_id,
      slack_team_id,
      slack_team_name,
      bot_user_id,
      default_channel_id,
      followup_frequency_hours,
      auto_followup_enabled
    `)
    .eq('installation_status', 'active');

  if (targetWorkspaceId) {
    query = query.eq('workspace_id', targetWorkspaceId);
  }

  const { data: installations, error: instError } = await query;
  if (instError || !installations) {
    return summaries;
  }

  for (const inst of installations) {
    const summary: FollowupRunSummary = {
      workspaceId: inst.workspace_id,
      slackTeamId: inst.slack_team_id,
      tasksEvaluated: 0,
      followupsSent: 0,
      skippedRecent: 0,
      unmappedAssignees: 0,
      errors: [],
    };

    if (!inst.auto_followup_enabled) {
      summaries.push(summary);
      continue;
    }

    // 2. Fetch bot token
    const { data: secretData } = await supabase
      .from('slack_installation_secrets')
      .select('bot_token')
      .eq('installation_id', inst.id)
      .single();

    const slackClient = getSlackWebClient(secretData?.bot_token);
    if (!slackClient) {
      summary.errors.push('Slack bot token is not configured for this installation.');
      summaries.push(summary);
      continue;
    }

    // 3. Fetch open, assigned tasks for this workspace
    const { data: openTasks, error: taskError } = await supabase
      .from('tasks')
      .select(`
        id,
        task_number,
        title,
        status,
        priority,
        due_date,
        assignee_id,
        slack_channel_id,
        slack_message_ts,
        slack_thread_ts,
        updated_at,
        project:projects ( identifier, name )
      `)
      .eq('workspace_id', inst.workspace_id)
      .not('assignee_id', 'is', null)
      .not('status', 'in', '("Done","Cancelled")');

    if (taskError || !openTasks) {
      summary.errors.push(`Failed to fetch tasks: ${taskError?.message}`);
      summaries.push(summary);
      continue;
    }

    summary.tasksEvaluated = openTasks.length;

    // 4. Threshold for follow-up
    const frequencyHours = inst.followup_frequency_hours || 24;
    const cutoffTime = new Date(Date.now() - frequencyHours * 60 * 60 * 1000).toISOString();

    for (const task of openTasks) {
      if (!task.assignee_id) continue;

      // Check if task was updated recently (within frequency window)
      if (task.updated_at && task.updated_at > cutoffTime) {
        summary.skippedRecent++;
        continue;
      }

      // Check if a follow-up was already sent recently
      const { data: recentFollowup } = await supabase
        .from('task_followups')
        .select('id, sent_at')
        .eq('task_id', task.id)
        .gte('sent_at', cutoffTime)
        .limit(1);

      if (recentFollowup && recentFollowup.length > 0) {
        summary.skippedRecent++;
        continue;
      }

      // Look up assignee's Slack identity
      const { data: mapping } = await supabase
        .from('slack_user_mappings')
        .select('slack_user_id')
        .eq('workspace_id', inst.workspace_id)
        .eq('taskpilot_user_id', task.assignee_id)
        .eq('link_status', 'linked')
        .single();

      if (!mapping || !mapping.slack_user_id) {
        summary.unmappedAssignees++;
        continue;
      }

      // 5. Determine destination: thread if task originated in Slack, else DM
      let channelId = mapping.slack_user_id;
      let threadTs: string | undefined = undefined;

      if (task.slack_channel_id) {
        channelId = task.slack_channel_id;
        threadTs = task.slack_thread_ts || task.slack_message_ts || undefined;
      }

      const projIdent = (task.project as any)?.identifier || 'TASK';
      const taskIdentifier = `${projIdent}-${task.task_number}`;
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      const taskUrl = `${siteUrl}/workspace/${inst.workspace_id}/tasks`;

      const sendResult = await sendFollowupMessage(
        slackClient,
        { channelId, threadTs },
        {
          taskIdentifier,
          title: task.title,
          currentStatus: task.status,
          dueDate: task.due_date,
          taskUrl,
        }
      );

      if (sendResult.ok && sendResult.ts) {
        summary.followupsSent++;

        // Record in task_followups
        await supabase.from('task_followups').insert({
          workspace_id: inst.workspace_id,
          task_id: task.id,
          recipient_user_id: task.assignee_id,
          slack_user_id: mapping.slack_user_id,
          channel_type: threadTs ? 'thread' : 'im',
          scheduled_at: new Date().toISOString(),
          sent_at: new Date().toISOString(),
          status: 'sent',
          attempt_count: 1,
          external_message_id: sendResult.ts,
          external_conversation_id: channelId,
        });

        // Record external message
        await supabase.from('external_messages').insert({
          workspace_id: inst.workspace_id,
          installation_id: inst.id,
          task_id: task.id,
          external_conversation_id: channelId,
          external_message_id: sendResult.ts,
          external_thread_id: threadTs || sendResult.ts,
          message_type: 'followup_sent',
          body_snippet: `Follow-up sent for ${taskIdentifier}`,
        });

        // Record activity event
        await supabase.from('activity_events').insert({
          workspace_id: inst.workspace_id,
          actor_id: null, // System event
          entity_type: 'task',
          entity_id: task.id,
          event_type: 'followup_sent',
          metadata: {
            task_identifier: taskIdentifier,
            recipient_slack_id: mapping.slack_user_id,
            origin: 'slack_automation',
          },
        });
      } else {
        summary.errors.push(
          `Failed sending follow-up for ${taskIdentifier}: ${sendResult.error}`
        );
      }
    }

    summaries.push(summary);
  }

  return summaries;
}

/**
 * Handles an inbound reply to an existing task thread or follow-up.
 */
export async function processTaskFollowupReply(params: {
  installationId: string;
  workspaceId: string;
  taskId: string;
  senderSlackId: string;
  senderMemberId: string;
  channelId: string;
  messageTs: string;
  threadTs?: string;
  replyText: string;
}): Promise<{ success: boolean; message: string }> {
  const supabase = createServiceClient();
  const {
    installationId,
    workspaceId,
    taskId,
    senderMemberId,
    channelId,
    messageTs,
    threadTs,
    replyText,
  } = params;

  // 1. Fetch task details
  const { data: task, error: taskErr } = await supabase
    .from('tasks')
    .select(`
      id,
      task_number,
      title,
      status,
      priority,
      assignee_id,
      project:projects ( identifier, name )
    `)
    .eq('id', taskId)
    .single();

  if (taskErr || !task) {
    return { success: false, message: 'Referenced task not found' };
  }

  const projIdent = (task.project as any)?.identifier || 'TASK';
  const taskIdentifier = `${projIdent}-${task.task_number}`;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const taskUrl = `${siteUrl}/workspace/${workspaceId}/tasks`;

  // 2. Parse conversational intent
  const parsed = parseSlackMessage(replyText);

  // Get Slack client
  const { data: secretData } = await supabase
    .from('slack_installation_secrets')
    .select('bot_token')
    .eq('installation_id', installationId)
    .single();

  const slackClient = getSlackWebClient(secretData?.bot_token);

  let newStatus: TaskStatus = task.status as TaskStatus;
  let statusChanged = false;
  let commentAdded = false;

  if (parsed.intent === 'update_status' && parsed.status) {
    newStatus = parsed.status;
    statusChanged = true;
  } else if (parsed.intent === 'report_blocker') {
    newStatus = 'Blocked';
    statusChanged = true;
  }

  // 3. Update task status if changed
  if (statusChanged && newStatus !== task.status) {
    await supabase
      .from('tasks')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', task.id);

    // Record activity event
    await supabase.from('activity_events').insert({
      workspace_id: workspaceId,
      actor_id: senderMemberId,
      entity_type: 'task',
      entity_id: task.id,
      event_type: 'status_changed',
      metadata: {
        old_status: task.status,
        new_status: newStatus,
        origin: 'slack_reply',
        slack_user_id: params.senderSlackId,
      },
    });
  }

  // 4. Add comment or blocker note
  const commentBody = parsed.blockerReason || replyText.trim();
  if (commentBody) {
    await supabase.from('task_comments').insert({
      task_id: task.id,
      author_id: senderMemberId,
      body: `[Slack Update] ${commentBody}`,
    });
    commentAdded = true;

    // Record activity event
    await supabase.from('activity_events').insert({
      workspace_id: workspaceId,
      actor_id: senderMemberId,
      entity_type: 'task',
      entity_id: task.id,
      event_type: 'comment_added',
      metadata: {
        origin: 'slack_reply',
        slack_user_id: params.senderSlackId,
      },
    });
  }

  // 5. Mark pending follow-ups as responded
  await supabase
    .from('task_followups')
    .update({
      status: 'responded',
      responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('task_id', task.id)
    .eq('status', 'sent');

  // 6. Record external message
  await supabase.from('external_messages').insert({
    workspace_id: workspaceId,
    installation_id: installationId,
    task_id: task.id,
    external_conversation_id: channelId,
    external_message_id: messageTs,
    external_thread_id: threadTs || messageTs,
    message_type: 'followup_reply',
    body_snippet: replyText.slice(0, 150),
  });

  // 7. Post confirmation back in thread
  if (slackClient) {
    await sendStatusUpdatedConfirmation(
      slackClient,
      { channelId, threadTs: threadTs || messageTs },
      taskIdentifier,
      newStatus,
      taskUrl,
      parsed.blockerReason
    );
  }

  return {
    success: true,
    message: `Updated ${taskIdentifier}: status=${newStatus}, commentAdded=${commentAdded}`,
  };
}
