import { WebClient } from '@slack/web-api';

export interface SlackMessageTarget {
  channelId: string;
  threadTs?: string;
}

export interface TaskSummaryPayload {
  taskIdentifier: string; // e.g. "CORE-15"
  title: string;
  projectName: string;
  priority: string;
  status: string;
  assigneeName?: string | null;
  taskUrl: string;
}

/**
 * Creates an authorized Slack WebClient.
 * Reads token from argument or server environment variable SLACK_BOT_TOKEN.
 */
export function getSlackWebClient(token?: string): WebClient | null {
  const botToken = token || process.env.SLACK_BOT_TOKEN;
  if (!botToken) {
    return null;
  }
  return new WebClient(botToken);
}

/**
 * Sends a structured task creation confirmation into a channel or thread.
 */
export async function sendTaskCreatedMessage(
  client: WebClient,
  target: SlackMessageTarget,
  payload: TaskSummaryPayload
): Promise<{ ok: boolean; ts?: string; error?: string }> {
  try {
    const assigneeText = payload.assigneeName
      ? `*Assignee:* ${payload.assigneeName}`
      : `*Assignee:* _Unassigned (routed to Team Lead triage)_`;

    const result = await client.chat.postMessage({
      channel: target.channelId,
      thread_ts: target.threadTs,
      text: `Created task *${payload.taskIdentifier}*: ${payload.title}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Task Created:* <${payload.taskUrl}|*${payload.taskIdentifier}* — ${payload.title}>\n*Project:* ${payload.projectName} | *Priority:* \`${payload.priority}\` | *Status:* \`${payload.status}\`\n${assigneeText}`,
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'View in TaskPilot',
                emoji: true,
              },
              url: payload.taskUrl,
              style: 'primary',
            },
          ],
        },
      ],
    });

    return { ok: true, ts: result.ts };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to send Slack message',
    };
  }
}

/**
 * Sends a task follow-up progress request directly to a member (DM or channel thread).
 */
export async function sendFollowupMessage(
  client: WebClient,
  target: SlackMessageTarget,
  task: {
    taskIdentifier: string;
    title: string;
    currentStatus: string;
    dueDate?: string | null;
    taskUrl: string;
  }
): Promise<{ ok: boolean; ts?: string; error?: string }> {
  try {
    const dueNotice = task.dueDate ? ` (Due: ${task.dueDate})` : '';

    const result = await client.chat.postMessage({
      channel: target.channelId,
      thread_ts: target.threadTs,
      text: `Quick update on ${task.taskIdentifier}: ${task.title}. Is it still ${task.currentStatus}, completed, or blocked?`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*TaskPilot Follow-up Request:*\nHow is progress on <${task.taskUrl}|*${task.taskIdentifier}* — ${task.title}>${dueNotice}?\n\nCurrent Status: \`${task.currentStatus}\`\n_Reply in this thread with *Done*, *In Progress*, or *Blocked: [reason]* to automatically update the dashboard._`,
          },
        },
      ],
    });

    return { ok: true, ts: result.ts };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to send follow-up message',
    };
  }
}

/**
 * Sends an update confirmation (e.g. after a member replies "Done").
 */
export async function sendStatusUpdatedConfirmation(
  client: WebClient,
  target: SlackMessageTarget,
  taskIdentifier: string,
  newStatus: string,
  taskUrl: string,
  commentNote?: string
): Promise<{ ok: boolean; ts?: string; error?: string }> {
  try {
    const noteText = commentNote ? `\n*Note added:* _"${commentNote}"_` : '';
    const result = await client.chat.postMessage({
      channel: target.channelId,
      thread_ts: target.threadTs,
      text: `Updated ${taskIdentifier} status to ${newStatus}.`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:white_check_mark: Updated <${taskUrl}|*${taskIdentifier}*> status to \`${newStatus}\`.${noteText}`,
          },
        },
      ],
    });

    return { ok: true, ts: result.ts };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to send status update',
    };
  }
}

/**
 * Sends a clarification request when intent or project cannot be resolved safely.
 */
export async function sendClarificationMessage(
  client: WebClient,
  target: SlackMessageTarget,
  question: string,
  options?: string[]
): Promise<{ ok: boolean; ts?: string; error?: string }> {
  try {
    let optionsText = '';
    if (options && options.length > 0) {
      optionsText = `\n\n*Available options:*\n${options.map((o) => `&bull; ${o}`).join('\n')}`;
    }

    const result = await client.chat.postMessage({
      channel: target.channelId,
      thread_ts: target.threadTs,
      text: question,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:mag: *Clarification Needed:*\n${question}${optionsText}`,
          },
        },
      ],
    });

    return { ok: true, ts: result.ts };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to send clarification',
    };
  }
}

/**
 * Sends help message explaining supported conversational patterns.
 */
export async function sendHelpMessage(
  client: WebClient,
  target: SlackMessageTarget
): Promise<{ ok: boolean; ts?: string; error?: string }> {
  try {
    const result = await client.chat.postMessage({
      channel: target.channelId,
      thread_ts: target.threadTs,
      text: 'TaskPilot Slack Bot Commands & Guide',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: 'TaskPilot Slack Commands',
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Create a Task:*\n\`@TaskPilot create a task to [Title] in project [PROJECT_ID] [Priority] [due Date]\`\n_Example: \`@TaskPilot create a task to fix login memory leak in project CORE high priority due Friday\`_\n\n*Update Task Status:*\n\`@TaskPilot [TASK-ID] is Done\` or \`@TaskPilot [TASK-ID] in progress\`\n\n*Report Blocker:*\n\`@TaskPilot [TASK-ID] is blocked waiting for database credentials\`\n\n*Respond to Follow-ups:*\nSimply reply in the follow-up thread with your status or blocker.`,
          },
        },
      ],
    });

    return { ok: true, ts: result.ts };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to send help',
    };
  }
}

/**
 * Sends notification that user identity needs to be linked.
 */
export async function sendUnlinkedUserNotice(
  client: WebClient,
  target: SlackMessageTarget,
  slackUserId: string
): Promise<{ ok: boolean; ts?: string; error?: string }> {
  try {
    const result = await client.chat.postMessage({
      channel: target.channelId,
      thread_ts: target.threadTs,
      text: `Your Slack account <@${slackUserId}> is not linked to a TaskPilot workspace member.`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:warning: *Identity Not Linked:*\nYour Slack account (<@${slackUserId}>) is not yet mapped to a member in this TaskPilot workspace.\n\nPlease ask your workspace administrator to map your Slack identity under *Admin &rarr; Integrations* in the TaskPilot dashboard.`,
          },
        },
      ],
    });

    return { ok: true, ts: result.ts };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to send unlinked notice',
    };
  }
}

/**
 * Resolves the canonical Slack OAuth callback URL.
 * Protects against misconfigured environment variables pointing to Supabase OIDC callback.
 */
export function resolveSlackRedirectUri(reqUrl?: string): string {
  const envUri = process.env.SLACK_REDIRECT_URI;
  if (envUri && envUri.includes('/api/slack/callback')) {
    return envUri;
  }
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (reqUrl ? new URL(reqUrl).origin : 'https://kaunteya.vercel.app');
  return `${siteUrl.replace(/\/$/, '')}/api/slack/callback`;
}

