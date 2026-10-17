import { NextRequest, NextResponse } from 'next/server';
import { verifySlackSignature } from '@/lib/slack/verify-signature';
import { parseSlackMessage } from '@/lib/slack/parser';
import { evaluateTaskRouting, type WorkspaceMemberContext } from '@/lib/slack/routing';
import {
  evaluateAgentAssistedRouting,
  persistRoutingDecision,
  type MemberWorkloadContext,
  type ProjectContext,
} from '@/lib/routing/agent-router';
import {
  getSlackWebClient,
  sendTaskCreatedMessage,
  sendClarificationMessage,
  sendHelpMessage,
  sendUnlinkedUserNotice,
  sendStatusUpdatedConfirmation,
} from '@/lib/slack/client';
import { processTaskFollowupReply } from '@/lib/slack/followup';
import { createServiceClient, hasServiceRoleKey } from '@/lib/supabase/service';
import { WebClient } from '@slack/web-api';

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
  if (body.type === 'url_verification') {
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
    .maybeSingle();

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

  const channelId = event.channel;
  const messageTs = event.ts;
  const threadTs = event.thread_ts || event.ts;
  const rawText = event.text || '';

  // 5. Handle Linking Challenge Command (e.g. "@TaskPilot link TP-1234" or "link TP-1234")
  const linkCommandMatch = rawText.match(/\b(?:link|connect)\s+([A-Za-z0-9-]+)\b/i);
  if (linkCommandMatch) {
    const challengeCode = linkCommandMatch[1].trim().toUpperCase();
    const { data: challenge } = await supabase
      .from('slack_link_challenges')
      .select('id, user_id, workspace_id, expires_at, consumed_at')
      .eq('challenge_code', challengeCode)
      .is('consumed_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (challenge) {
      // Verify user is an active member of this challenge's workspace
      const { data: targetMember } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', challenge.workspace_id)
        .eq('user_id', challenge.user_id)
        .maybeSingle();

      if (targetMember) {
        // Mark challenge consumed
        await supabase
          .from('slack_link_challenges')
          .update({ consumed_at: new Date().toISOString() })
          .eq('id', challenge.id);

        // Ensure active installation exists for this workspace
        let { data: chalInst } = await supabase
          .from('slack_installations')
          .select('*')
          .eq('workspace_id', challenge.workspace_id)
          .eq('slack_team_id', teamId)
          .maybeSingle();

        const botTokenForChal = process.env.SLACK_BOT_TOKEN;
        if (!chalInst && botTokenForChal) {
          const testWeb = new WebClient(botTokenForChal);
          const aTest = await testWeb.auth.test();
          const { data: newInst } = await supabase
            .from('slack_installations')
            .upsert(
              {
                workspace_id: challenge.workspace_id,
                slack_team_id: teamId,
                slack_team_name: aTest.team || 'Slack Workspace',
                bot_user_id: aTest.user_id || 'U_BOT',
                installation_status: 'active',
                connected_by: challenge.user_id,
                connected_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'workspace_id,slack_team_id' }
            )
            .select()
            .single();

          if (newInst) {
            chalInst = newInst;
            await supabase.from('slack_installation_secrets').upsert(
              {
                installation_id: newInst.id,
                bot_token: botTokenForChal,
                signing_secret: process.env.SLACK_SIGNING_SECRET || null,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'installation_id' }
            );
          }
        }

        if (chalInst) {
          const { data: targetProfile } = await supabase
            .from('profiles')
            .select('id, display_name, email')
            .eq('id', challenge.user_id)
            .single();

          await supabase.from('slack_user_mappings').upsert(
            {
              installation_id: chalInst.id,
              workspace_id: challenge.workspace_id,
              slack_user_id: event.user,
              taskpilot_user_id: challenge.user_id,
              link_status: 'linked',
              linked_by: challenge.user_id,
              linked_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'workspace_id,slack_user_id' }
          );

          const chalClient = getSlackWebClient(botTokenForChal);
          if (chalClient) {
            await chalClient.chat.postMessage({
              channel: channelId,
              thread_ts: threadTs,
              text: `✅ *Identity Verified!* Your Slack account is now linked to *${targetProfile?.display_name || 'Member'}* in TaskPilot. You can now create tasks, update statuses, and coordinate with TaskPilot.`,
            });
          }

          await supabase
            .from('integration_events')
            .update({
              workspace_id: challenge.workspace_id,
              installation_id: chalInst.id,
              processing_status: 'processed',
              error_summary: 'Identity linked via challenge code',
              processed_at: new Date().toISOString(),
            })
            .eq('provider', 'slack')
            .eq('external_event_id', eventId);

          return NextResponse.json({ ok: true, processed: 'identity_linked' });
        }
      }
    }
  }

  // 6. Look up matching Installation & User Identity across TaskPilot Workspaces
  let installation: any = null;
  let userMapping: any = null;

  // Step 6a: Check if sender is already mapped to any workspace in this Slack team
  try {
    const { data: existingMappings } = await supabase
      .from('slack_user_mappings')
      .select(`
        id,
        workspace_id,
        installation_id,
        taskpilot_user_id,
        link_status,
        profiles:taskpilot_user_id (
          id,
          display_name,
          email
        )
      `)
      .eq('slack_user_id', event.user)
      .eq('link_status', 'linked');

    if (existingMappings && existingMappings.length > 0) {
      for (const em of existingMappings) {
        let { data: inst } = await supabase
          .from('slack_installations')
          .select('*')
          .eq('id', em.installation_id)
          .eq('slack_team_id', teamId)
          .eq('installation_status', 'active')
          .maybeSingle();

        if (!inst) {
          const { data: instByWs } = await supabase
            .from('slack_installations')
            .select('*')
            .eq('workspace_id', em.workspace_id)
            .eq('slack_team_id', teamId)
            .eq('installation_status', 'active')
            .maybeSingle();
          inst = instByWs;
        }

        if (inst) {
          // Verify user is an active member of this workspace
          const { data: mem } = await supabase
            .from('workspace_members')
            .select('role')
            .eq('workspace_id', em.workspace_id)
            .eq('user_id', em.taskpilot_user_id)
            .maybeSingle();

          if (mem) {
            installation = inst;
            userMapping = em;
            break;
          }
        }
      }
    }
  } catch (e) {
    console.warn('[Slack Events] Existing mapping check encountered error:', e);
  }

  // Step 6b: If no direct mapping match, look up active installations for this Slack team
  let teamInstallations: any[] = [];
  try {
    const { data: insts } = await supabase
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
      .eq('installation_status', 'active');
    teamInstallations = insts || [];
  } catch (e) {
    console.warn('[Slack Events] Team installations lookup error:', e);
  }

  // Obtain bot token candidate
  const envBotToken = process.env.SLACK_BOT_TOKEN;
  let activeBotToken = envBotToken;
  if (!activeBotToken && teamInstallations.length > 0) {
    const { data: sec } = await supabase
      .from('slack_installation_secrets')
      .select('bot_token')
      .eq('installation_id', teamInstallations[0].id)
      .maybeSingle();
    activeBotToken = sec?.bot_token || undefined;
  }

  // Step 6c: Fetch sender's Slack profile (email/username) to resolve legitimate workspace
  let senderEmail: string | null = null;
  let senderUsername: string | null = null;
  let senderRealName: string | null = null;

  if (activeBotToken) {
    try {
      const infoClient = new WebClient(activeBotToken);
      const userInfo = await infoClient.users.info({ user: event.user });
      if (userInfo.ok && userInfo.user) {
        senderEmail = userInfo.user.profile?.email?.toLowerCase() || null;
        senderUsername = userInfo.user.name || null;
        senderRealName = userInfo.user.real_name || userInfo.user.profile?.real_name || null;
      }
    } catch (e) {
      console.warn('[Slack Events] Could not query sender info:', e);
    }
  }

  // Step 6d: If sender email is known, match against workspace members to find legitimate workspace
  if (!userMapping && senderEmail) {
    // 1. First check if any existing team installation contains this member
    if (teamInstallations.length > 0) {
      for (const inst of teamInstallations) {
        try {
          const { data: members } = await supabase
            .from('workspace_members')
            .select('user_id, role, profiles:user_id(id, email, display_name)')
            .eq('workspace_id', inst.workspace_id);

          const matchedMem = members?.find(
            (m: any) => m.profiles?.email?.toLowerCase() === senderEmail
          );

          if (matchedMem) {
            installation = inst;
            // Auto-map user into this workspace
            const { data: newMapping } = await supabase
              .from('slack_user_mappings')
              .upsert(
                {
                  installation_id: inst.id,
                  workspace_id: inst.workspace_id,
                  slack_user_id: event.user,
                  slack_username: senderUsername,
                  slack_real_name: senderRealName,
                  slack_email: senderEmail,
                  taskpilot_user_id: matchedMem.user_id,
                  link_status: 'linked',
                  linked_by: matchedMem.user_id,
                  linked_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                { onConflict: 'workspace_id,slack_user_id' }
              )
              .select(`
                id,
                taskpilot_user_id,
                link_status,
                profiles:taskpilot_user_id (
                  id,
                  display_name,
                  email
                )
              `)
              .single();

            if (newMapping) {
              userMapping = newMapping;
              break;
            }
          }
        } catch {
          // non-fatal
        }
      }
    }

    // 2. If no match in existing installations, check if the sender is an admin/member of ANY workspace in TaskPilot
    if (!userMapping && envBotToken) {
      try {
        const { data: userWorkspaces } = await supabase
          .from('workspace_members')
          .select('workspace_id, role, user_id, profiles!inner(id, email, display_name)')
          .eq('profiles.email', senderEmail);

        if (userWorkspaces && userWorkspaces.length > 0) {
          // Prioritize workspace where user is admin
          const targetWs = userWorkspaces.find((w: any) => w.role === 'admin') || userWorkspaces[0];
          console.log(`[Slack Events] Reconciling Slack team ${teamId} into legitimate user workspace ${targetWs.workspace_id}`);

          const testWeb = new WebClient(envBotToken);
          const aTest = await testWeb.auth.test();

          const { data: autoInst } = await supabase
            .from('slack_installations')
            .upsert(
              {
                workspace_id: targetWs.workspace_id,
                slack_team_id: teamId,
                slack_team_name: aTest.team || 'Slack Workspace',
                bot_user_id: aTest.user_id || 'U_BOT',
                installation_status: 'active',
                connected_by: targetWs.user_id,
                connected_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'workspace_id,slack_team_id' }
            )
            .select()
            .single();

          if (autoInst) {
            installation = autoInst;
            await supabase.from('slack_installation_secrets').upsert(
              {
                installation_id: autoInst.id,
                bot_token: envBotToken,
                signing_secret: process.env.SLACK_SIGNING_SECRET || null,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'installation_id' }
            );

            // Auto-map user into this workspace
            const { data: newMapping } = await supabase
              .from('slack_user_mappings')
              .upsert(
                {
                  installation_id: autoInst.id,
                  workspace_id: targetWs.workspace_id,
                  slack_user_id: event.user,
                  slack_username: senderUsername,
                  slack_real_name: senderRealName,
                  slack_email: senderEmail,
                  taskpilot_user_id: targetWs.user_id,
                  link_status: 'linked',
                  linked_by: targetWs.user_id,
                  linked_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                { onConflict: 'workspace_id,slack_user_id' }
              )
              .select(`
                id,
                taskpilot_user_id,
                link_status,
                profiles:taskpilot_user_id (
                  id,
                  display_name,
                  email
                )
              `)
              .single();

            if (newMapping) {
              userMapping = newMapping;
            }
          }
        }
      } catch (wsErr) {
        console.warn('[Slack Events] Workspace reconciliation check error:', wsErr);
      }
    }
  }

  // Fallback: If installation is not yet selected, pick the single candidate installation if exists
  if (!installation && teamInstallations && teamInstallations.length === 1) {
    installation = teamInstallations[0];
  }

  if (!installation) {
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

  // Look up bot token for this installation
  const { data: secretData } = await supabase
    .from('slack_installation_secrets')
    .select('bot_token')
    .eq('installation_id', installation.id)
    .maybeSingle();

  const botToken = secretData?.bot_token || process.env.SLACK_BOT_TOKEN;
  const slackClient = getSlackWebClient(botToken);

  // If user is not mapped, send unlinked notice and ignore
  if (!userMapping) {
    if (slackClient) {
      await sendUnlinkedUserNotice(slackClient, { channelId, threadTs }, event.user);
    }

    await supabase
      .from('integration_events')
      .update({
        processing_status: 'ignored',
        error_code: 'UNMAPPED_SLACK_USER',
        error_summary: `Slack user ${event.user} is not mapped to a TaskPilot member in workspace ${installation.workspace_id}`,
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
    .maybeSingle();

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

  // 9. Thread Reply Handling (Check if this is a reply to an ongoing task thread)
  if (event.thread_ts && event.thread_ts !== event.ts) {
    const { data: linkedMsg } = await supabase
      .from('external_messages')
      .select('task_id')
      .eq('installation_id', installation.id)
      .eq('external_thread_id', event.thread_ts)
      .not('task_id', 'is', null)
      .limit(1)
      .maybeSingle();

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

  // 10. Parse Conversational Intent
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
      .maybeSingle();

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
      if (matched) resolvedProject = matched;
    }

    // 2. Fetch Workspace Members & Leads
    const { data: memberRows } = await supabase
      .from('workspace_members')
      .select(`
        user_id,
        role,
        profiles:user_id (
          id,
          display_name
        )
      `)
      .eq('workspace_id', installation.workspace_id);

    const { data: allMappings } = await supabase
      .from('slack_user_mappings')
      .select('taskpilot_user_id, slack_user_id')
      .eq('workspace_id', installation.workspace_id)
      .eq('link_status', 'linked');

    const mappingMap = new Map<string, string>();
    allMappings?.forEach((m) => mappingMap.set(m.taskpilot_user_id, m.slack_user_id));

    // Fetch open tasks per member to compute workloads
    const { data: openTasks } = await supabase
      .from('tasks')
      .select('assignee_id')
      .eq('workspace_id', installation.workspace_id)
      .in('status', ['Backlog', 'Todo', 'In Progress', 'In Review', 'Blocked']);

    const workloadMap = new Map<string, number>();
    openTasks?.forEach((t) => {
      if (t.assignee_id) {
        workloadMap.set(t.assignee_id, (workloadMap.get(t.assignee_id) || 0) + 1);
      }
    });

    const workspaceMembers: MemberWorkloadContext[] = (memberRows || []).map((m: any) => ({
      userId: m.user_id,
      role: m.role,
      displayName: m.profiles?.display_name || 'Member',
      slackUserId: mappingMap.get(m.user_id),
      openTaskCount: workloadMap.get(m.user_id) || 0,
    }));

    const designatedLead = workspaceMembers.find((m) => m.role === 'lead') || null;

    // 3. Evaluate Agent-Assisted Task Routing (Rules 1-7)
    const agentRoutingResult = await evaluateAgentAssistedRouting({
      requesterMember: requesterContext,
      designatedLead,
      workspaceMembers,
      projects: workspaceProjects.map((p) => ({
        id: p.id,
        name: p.name,
        identifier: p.identifier,
      })),
      rawRequestText: rawText,
      explicitAssigneeSlackId: parsed.assigneeMention,
      projectNameHint: parsed.projectNameHint,
    });

    const routingDecision = agentRoutingResult.decision;

    // 4. Get Next Task Number for this project
    const { data: nextNum } = await supabase.rpc('get_next_task_number', {
      p_project_id: resolvedProject.id,
    });
    const taskNumber = nextNum || 1;

    // 5. Determine initial task status based on routing
    let initialStatus: string = 'Todo';
    if (routingDecision.action === 'route_to_lead_inbox' || routingDecision.requiresLeadTriage) {
      initialStatus = 'Backlog';
    }

    // 6. Create Task in Database
    const { data: createdTask, error: taskError } = await supabase
      .from('tasks')
      .insert({
        project_id: resolvedProject.id,
        workspace_id: installation.workspace_id,
        task_number: taskNumber,
        title: parsed.title || 'Untitled Slack Task',
        description: parsed.description || `Created via Slack from message: "${rawText}"`,
        priority: parsed.priority || 'Medium',
        status: initialStatus as any,
        assignee_id: routingDecision.assigneeUserId,
        created_by: requesterContext.userId,
        due_date: parsed.dueDate || null,
      })
      .select('id, title, priority, status')
      .single();

    if (taskError || !createdTask) {
      console.error('[Slack Events] Failed to create task:', taskError);
      return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
    }

    // Persist Routing Decision in routing_decisions table
    await persistRoutingDecision(
      supabase,
      installation.workspace_id,
      createdTask.id,
      agentRoutingResult,
      'slack'
    );

    const taskIdentifier = `${resolvedProject.identifier}-${taskNumber}`;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const taskUrl = `${siteUrl}/workspace/${installation.workspace_id}/tasks`;

    // 7. Record External Message Mapping
    await supabase.from('external_messages').insert({
      installation_id: installation.id,
      workspace_id: installation.workspace_id,
      external_conversation_id: channelId,
      external_message_id: messageTs,
      external_thread_id: threadTs || null,
      sender_mapping_id: userMapping?.id || null,
      task_id: createdTask.id,
      body_snippet: rawText ? rawText.slice(0, 500) : null,
      message_type: 'task_intake',
    });

    // Activity event
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

  // Fallback for Conversational / Ambiguous / General Input
  if (slackClient) {
    // Fetch user's active tasks in this workspace
    const { data: userTasks } = await supabase
      .from('tasks')
      .select(`
        id,
        task_number,
        title,
        status,
        priority,
        project:projects!inner ( identifier, name )
      `)
      .eq('workspace_id', installation.workspace_id)
      .eq('assignee_id', requesterContext.userId)
      .not('status', 'in', '("Done","Cancelled")')
      .order('created_at', { ascending: false })
      .limit(5);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const workspaceTasksUrl = `${siteUrl}/workspace/${installation.workspace_id}/tasks`;

    let replyText = `👋 Hello *${requesterContext.displayName}*! I'm TaskPilot, your delivery coordination agent.`;

    if (userTasks && userTasks.length > 0) {
      const taskList = userTasks
        .map((t: any) => `• <${siteUrl}/workspace/${installation.workspace_id}/tasks|*${t.project.identifier}-${t.task_number}*>: ${t.title} (\`${t.status}\` | \`${t.priority}\`)`)
        .join('\n');
      replyText += `\n\n*Your Active Tasks:*\n${taskList}\n\n<${workspaceTasksUrl}|View all tasks in TaskPilot>`;
    } else {
      replyText += `\nYou currently have no open tasks assigned in this workspace.`;
    }

    replyText += `\n\n*What would you like to do?*\n• *Create a task:* \`@TaskPilot create a task to [title] in project [ID]\`\n• *Update status:* \`@TaskPilot [TASK-ID] is Done\` or \`in progress\`\n• *Report a blocker:* \`@TaskPilot [TASK-ID] is blocked waiting for [reason]\`\n• *Help:* \`@TaskPilot help\``;

    await slackClient.chat.postMessage({
      channel: channelId,
      ...(event.thread_ts ? { thread_ts: event.thread_ts } : {}),
      text: replyText,
    });
  }

  await supabase
    .from('integration_events')
    .update({
      processing_status: 'processed',
      error_summary: 'Conversational agent guidance provided.',
      processed_at: new Date().toISOString(),
    })
    .eq('provider', 'slack')
    .eq('external_event_id', eventId);

  return NextResponse.json({ ok: true, processed: 'agent_guidance' });
}
