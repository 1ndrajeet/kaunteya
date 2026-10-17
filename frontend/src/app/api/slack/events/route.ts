import { NextRequest, NextResponse } from 'next/server';
import { verifySlackSignature } from '@/lib/slack/verify-signature';
import { parseSlackMessage } from '@/lib/slack/parser';
import { evaluateTaskRouting, type WorkspaceMemberContext } from '@/lib/slack/routing';
import {
  getSlackWebClient,
  sendTaskCreatedMessage,
  sendClarificationMessage,
  sendHelpMessage,
  sendUnlinkedUserNotice,
  sendStatusUpdatedConfirmation,
} from '@/lib/slack/client';
import { processTaskFollowupReply } from '@/lib/slack/followup';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(req: NextRequest) {
  // 1. Read raw body text for HMAC signature verification
  const rawBody = await req.text();
  const signature = req.headers.get('x-slack-signature');
  const timestamp = req.headers.get('x-slack-request-timestamp');

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  // 2. Handle Slack URL Verification Challenge
  // (Slack sends this during initial Event Subscription setup)
  if (body.type === 'url_verification') {
    // If signing secret is configured, verify it even for url_verification
    const defaultSigningSecret = process.env.SLACK_SIGNING_SECRET;
    if (defaultSigningSecret) {
      const verification = verifySlackSignature({
        signature,
        timestamp,
        rawBody,
        signingSecret: defaultSigningSecret,
      });
      if (!verification.isValid) {
        return NextResponse.json({ error: verification.reason }, { status: 401 });
      }
    }

    return NextResponse.json({ challenge: body.challenge });
  }

  // 3. Verify Slack Request Signature
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    console.error('[Slack Events] SLACK_SIGNING_SECRET is not configured on the server');
    return NextResponse.json(
      { error: 'Server configuration error: missing SLACK_SIGNING_SECRET' },
      { status: 500 }
    );
  }

  const verification = verifySlackSignature({
    signature,
    timestamp,
    rawBody,
    signingSecret,
  });

  if (!verification.isValid) {
    console.warn(`[Slack Events] Rejected request: ${verification.reason}`);
    return NextResponse.json({ error: verification.reason }, { status: 401 });
  }

  // 4. Idempotency Check & Event Registration
  const eventId = body.event_id || body.event?.event_ts || `evt_${Date.now()}`;
  const teamId = body.team_id;
  const event = body.event;

  // Immediately ignore Slack bot's own messages to prevent feedback loops
  if (!event || event.bot_id || event.subtype === 'bot_message') {
    return NextResponse.json({ ok: true, ignored: 'bot_message' });
  }

  const supabase = createServiceClient();

  // Check if event has already been received/processed
  const { data: existingEvent } = await supabase
    .from('integration_events')
    .select('id, processing_status')
    .eq('provider', 'slack')
    .eq('external_event_id', eventId)
    .single();

  if (existingEvent) {
    // Duplicate delivery from Slack retry
    return NextResponse.json({ ok: true, duplicate: true, status: existingEvent.processing_status });
  }

  // Record received event
  await supabase.from('integration_events').insert({
    provider: 'slack',
    external_event_id: eventId,
    event_type: event.type || body.type,
    processing_status: 'received',
    metadata: {
      team_id: teamId,
      channel: event.channel,
      user: event.user,
      text_preview: (event.text || '').slice(0, 100),
    },
  });

  // 5. Look up matching TaskPilot Workspace Installation
  const { data: installation, error: instError } = await supabase
    .from('slack_installations')
    .select(`
      id,
      workspace_id,
      slack_team_id,
      slack_team_name,
      bot_user_id,
      default_channel_id,
      notification_channel_id,
      installation_status
    `)
    .eq('slack_team_id', teamId)
    .eq('installation_status', 'active')
    .single();

  if (instError || !installation) {
    await supabase
      .from('integration_events')
      .update({
        processing_status: 'ignored',
        error_summary: `No active installation found for Slack Team ID ${teamId}`,
        processed_at: new Date().toISOString(),
      })
      .eq('provider', 'slack')
      .eq('external_event_id', eventId);

    return NextResponse.json({ ok: true, ignored: 'no_active_installation' });
  }

  // Associate event with workspace
  await supabase
    .from('integration_events')
    .update({
      workspace_id: installation.workspace_id,
      installation_id: installation.id,
    })
    .eq('provider', 'slack')
    .eq('external_event_id', eventId);

  // 6. Look up Bot Token for Outbound Replies
  const { data: secretData } = await supabase
    .from('slack_installation_secrets')
    .select('bot_token')
    .eq('installation_id', installation.id)
    .single();

  const slackClient = getSlackWebClient(secretData?.bot_token);
  if (!slackClient) {
    console.error(`[Slack Events] No bot token found for installation ${installation.id}`);
  }

  const channelId = event.channel;
  const messageTs = event.ts;
  const threadTs = event.thread_ts || event.ts;
  const rawText = event.text || '';

  // 7. Identity Mapping: Match Slack User to TaskPilot Member
  const { data: userMapping } = await supabase
    .from('slack_user_mappings')
    .select(`
      id,
      taskpilot_user_id,
      link_status,
      profiles:taskpilot_user_id (
        id,
        display_name
      )
    `)
    .eq('workspace_id', installation.workspace_id)
    .eq('slack_user_id', event.user)
    .eq('link_status', 'linked')
    .single();

  if (!userMapping) {
    // Unmapped Slack user attempted to interact
    if (slackClient) {
      await sendUnlinkedUserNotice(slackClient, { channelId, threadTs }, event.user);
    }

    await supabase
      .from('integration_events')
      .update({
        processing_status: 'ignored',
        error_code: 'UNMAPPED_SLACK_USER',
        error_summary: `Slack user ${event.user} is not mapped to a TaskPilot member`,
        processed_at: new Date().toISOString(),
      })
      .eq('provider', 'slack')
      .eq('external_event_id', eventId);

    return NextResponse.json({ ok: true, ignored: 'unmapped_user' });
  }

  // Verify the mapped user is still an active member of this workspace
  const { data: requesterMember } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', installation.workspace_id)
    .eq('user_id', userMapping.taskpilot_user_id)
    .single();

  if (!requesterMember) {
    await supabase
      .from('integration_events')
      .update({
        processing_status: 'failed',
        error_code: 'NOT_A_WORKSPACE_MEMBER',
        error_summary: `User is mapped but has no membership in workspace ${installation.workspace_id}`,
        processed_at: new Date().toISOString(),
      })
      .eq('provider', 'slack')
      .eq('external_event_id', eventId);

    return NextResponse.json({ ok: true, ignored: 'not_a_member' });
  }

  const requesterContext: WorkspaceMemberContext = {
    userId: userMapping.taskpilot_user_id,
    role: requesterMember.role as any,
    displayName: (userMapping.profiles as any)?.display_name || 'Member',
    slackUserId: event.user,
  };

  // 8. Thread Reply Handling (Check if this is a reply to an ongoing task thread)
  if (event.thread_ts && event.thread_ts !== event.ts) {
    const { data: linkedMsg } = await supabase
      .from('external_messages')
      .select('task_id')
      .eq('installation_id', installation.id)
      .eq('external_thread_id', event.thread_ts)
      .not('task_id', 'is', null)
      .limit(1)
      .single();

    if (linkedMsg?.task_id) {
      // Process as follow-up / task thread reply
      await processTaskFollowupReply({
        installationId: installation.id,
        workspaceId: installation.workspace_id,
        taskId: linkedMsg.task_id,
        senderSlackId: event.user,
        senderMemberId: requesterContext.userId,
        channelId,
        messageTs,
        threadTs: event.thread_ts,
        replyText: rawText,
      });

      await supabase
        .from('integration_events')
        .update({
          processing_status: 'processed',
          processed_at: new Date().toISOString(),
        })
        .eq('provider', 'slack')
        .eq('external_event_id', eventId);

      return NextResponse.json({ ok: true, processed: 'thread_reply' });
    }
  }

  // 9. Parse Conversational Intent
  const parsed = parseSlackMessage(rawText);

  // Intent A: Help
  if (parsed.intent === 'help') {
    if (slackClient) {
      await sendHelpMessage(slackClient, { channelId, threadTs });
    }

    await supabase
      .from('integration_events')
      .update({
        processing_status: 'processed',
        processed_at: new Date().toISOString(),
      })
      .eq('provider', 'slack')
      .eq('external_event_id', eventId);

    return NextResponse.json({ ok: true, processed: 'help' });
  }

  // Intent B: Update status of existing task mentioned by ID (e.g. "CORE-14 is Done")
  if (parsed.intent === 'update_status' && parsed.taskIdentifier) {
    const [identifierPrefix, taskNumStr] = parsed.taskIdentifier.split('-');
    const taskNum = parseInt(taskNumStr, 10);

    // Find the task
    const { data: matchedTask } = await supabase
      .from('tasks')
      .select(`
        id,
        status,
        title,
        task_number,
        project:projects!inner ( id, identifier, name )
      `)
      .eq('workspace_id', installation.workspace_id)
      .eq('task_number', taskNum)
      .eq('project.identifier', identifierPrefix)
      .single();

    if (!matchedTask) {
      if (slackClient) {
        await sendClarificationMessage(
          slackClient,
          { channelId, threadTs },
          `Could not find task *${parsed.taskIdentifier}* in this workspace.`
        );
      }
      return NextResponse.json({ ok: true, ignored: 'task_not_found' });
    }

    const newStatus = parsed.status || 'Done';
    await supabase
      .from('tasks')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', matchedTask.id);

    // Activity event
    await supabase.from('activity_events').insert({
      workspace_id: installation.workspace_id,
      actor_id: requesterContext.userId,
      entity_type: 'task',
      entity_id: matchedTask.id,
      event_type: 'status_changed',
      metadata: {
        old_status: matchedTask.status,
        new_status: newStatus,
        origin: 'slack_command',
        slack_user_id: event.user,
      },
    });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const taskUrl = `${siteUrl}/workspace/${installation.workspace_id}/tasks`;

    if (slackClient) {
      await sendStatusUpdatedConfirmation(
        slackClient,
        { channelId, threadTs },
        parsed.taskIdentifier,
        newStatus,
        taskUrl
      );
    }

    await supabase
      .from('integration_events')
      .update({
        processing_status: 'processed',
        processed_at: new Date().toISOString(),
      })
      .eq('provider', 'slack')
      .eq('external_event_id', eventId);

    return NextResponse.json({ ok: true, processed: 'status_updated' });
  }

  // Intent C: Create Task
  if (parsed.intent === 'create_task') {
    // 1. Resolve Project
    const { data: workspaceProjects } = await supabase
      .from('projects')
      .select('id, name, identifier')
      .eq('workspace_id', installation.workspace_id)
      .eq('status', 'active');

    if (!workspaceProjects || workspaceProjects.length === 0) {
      if (slackClient) {
        await sendClarificationMessage(
          slackClient,
          { channelId, threadTs },
          'No active projects found in this workspace. Please create a project in TaskPilot before creating tasks via Slack.'
        );
      }
      return NextResponse.json({ ok: true, ignored: 'no_projects' });
    }

    let resolvedProject = workspaceProjects[0]; // fallback if single project

    if (parsed.projectNameHint) {
      const hint = parsed.projectNameHint.toLowerCase();
      const matched = workspaceProjects.find(
        (p) =>
          p.identifier.toLowerCase() === hint ||
          p.name.toLowerCase().includes(hint)
      );
      if (matched) {
        resolvedProject = matched;
      } else if (workspaceProjects.length > 1) {
        // Project ambiguous
        if (slackClient) {
          await sendClarificationMessage(
            slackClient,
            { channelId, threadTs },
            `Could not resolve project "${parsed.projectNameHint}". Which project should this belong to?`,
            workspaceProjects.map((p) => `[${p.identifier}] ${p.name}`)
          );
        }
        return NextResponse.json({ ok: true, clarification_sent: 'project_ambiguous' });
      }
    } else if (workspaceProjects.length > 1) {
      // Ambiguous project: ask for clarification
      if (slackClient) {
        await sendClarificationMessage(
          slackClient,
          { channelId, threadTs },
          'Multiple projects exist in this workspace. Please specify the project for this task.',
          workspaceProjects.map((p) => `[${p.identifier}] ${p.name}`)
        );
      }
      return NextResponse.json({ ok: true, clarification_sent: 'project_needed' });
    }

    // 2. Resolve Workspace Members & Designated Lead for Routing
    const { data: memberRows } = await supabase
      .from('workspace_members')
      .select(`
        user_id,
        role,
        profiles:user_id ( display_name )
      `)
      .eq('workspace_id', installation.workspace_id);

    // Fetch Slack mappings for workspace members
    const { data: allMappings } = await supabase
      .from('slack_user_mappings')
      .select('taskpilot_user_id, slack_user_id')
      .eq('workspace_id', installation.workspace_id)
      .eq('link_status', 'linked');

    const mappingMap = new Map<string, string>();
    allMappings?.forEach((m) => mappingMap.set(m.taskpilot_user_id, m.slack_user_id));

    const workspaceMembers: WorkspaceMemberContext[] = (memberRows || []).map((m: any) => ({
      userId: m.user_id,
      role: m.role,
      displayName: m.profiles?.display_name || 'Member',
      slackUserId: mappingMap.get(m.user_id),
    }));

    const designatedLead = workspaceMembers.find((m) => m.role === 'lead') || null;

    // 3. Evaluate Deterministic Routing
    const routingDecision = evaluateTaskRouting({
      requesterMember: requesterContext,
      designatedLead,
      workspaceMembers,
      explicitAssigneeSlackId: parsed.assigneeMention,
    });

    // 4. Get Next Task Number for this project
    const { data: nextNum } = await supabase.rpc('get_next_task_number', {
      p_project_id: resolvedProject.id,
    });
    const taskNumber = nextNum || 1;

    // 5. Insert Task into Supabase
    const { data: createdTask, error: createError } = await supabase
      .from('tasks')
      .insert({
        workspace_id: installation.workspace_id,
        project_id: resolvedProject.id,
        task_number: taskNumber,
        title: parsed.title || 'Untitled Task',
        description: parsed.description || `Created via Slack by ${requesterContext.displayName}`,
        status: parsed.status || 'Todo',
        priority: parsed.priority || 'Medium',
        assignee_id: routingDecision.assigneeUserId,
        created_by: requesterContext.userId,
        due_date: parsed.dueDate || null,
        source: 'slack',
        slack_channel_id: channelId,
        slack_message_ts: messageTs,
        slack_thread_ts: threadTs,
      })
      .select()
      .single();

    if (createError || !createdTask) {
      console.error('[Slack Events] Failed to create task:', createError);
      return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
    }

    const taskIdentifier = `${resolvedProject.identifier}-${taskNumber}`;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const taskUrl = `${siteUrl}/workspace/${installation.workspace_id}/tasks`;

    // 6. Record in external_messages
    await supabase.from('external_messages').insert({
      workspace_id: installation.workspace_id,
      installation_id: installation.id,
      task_id: createdTask.id,
      external_conversation_id: channelId,
      external_message_id: messageTs,
      external_thread_id: threadTs,
      sender_mapping_id: userMapping.id,
      message_type: 'task_intake',
      body_snippet: rawText.slice(0, 150),
    });

    // 7. Record Activity Event
    await supabase.from('activity_events').insert({
      workspace_id: installation.workspace_id,
      actor_id: requesterContext.userId,
      entity_type: 'task',
      entity_id: createdTask.id,
      event_type: 'created',
      metadata: {
        task_identifier: taskIdentifier,
        title: createdTask.title,
        priority: createdTask.priority,
        origin: 'slack',
        routing_rule: routingDecision.ruleCode,
        routing_explanation: routingDecision.explanation,
        assignee_id: routingDecision.assigneeUserId,
      },
    });

    // 8. Send Confirmation Message to Slack
    if (slackClient) {
      await sendTaskCreatedMessage(
        slackClient,
        { channelId, threadTs },
        {
          taskIdentifier,
          title: createdTask.title,
          projectName: resolvedProject.name,
          priority: createdTask.priority,
          status: createdTask.status,
          assigneeName: routingDecision.assigneeDisplayName || null,
          taskUrl,
        }
      );
    }

    // 9. Update Integration Event to processed
    await supabase
      .from('integration_events')
      .update({
        processing_status: 'processed',
        processed_at: new Date().toISOString(),
      })
      .eq('provider', 'slack')
      .eq('external_event_id', eventId);

    return NextResponse.json({
      ok: true,
      task_id: createdTask.id,
      task_identifier: taskIdentifier,
      routing: routingDecision.ruleCode,
    });
  }

  // Fallback for Ambiguous / Unknown Input
  if (slackClient) {
    await sendClarificationMessage(
      slackClient,
      { channelId, threadTs },
      "I couldn't safely recognize this command. Try `@TaskPilot create a task to [title] in project [ID]` or `@TaskPilot help`."
    );
  }

  await supabase
    .from('integration_events')
    .update({
      processing_status: 'ignored',
      error_summary: 'Unrecognized intent; clarification message sent.',
      processed_at: new Date().toISOString(),
    })
    .eq('provider', 'slack')
    .eq('external_event_id', eventId);

  return NextResponse.json({ ok: true, processed: 'unknown_clarification' });
}
