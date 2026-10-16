import type { TaskPriority, TaskStatus } from '@/types/database';

export type SlackIntent =
  | 'create_task'
  | 'update_status'
  | 'report_blocker'
  | 'add_comment'
  | 'help'
  | 'unknown';

export interface ParsedSlackCommand {
  intent: SlackIntent;
  taskIdentifier?: string; // e.g. "CORE-14"
  title?: string;
  description?: string;
  projectNameHint?: string; // e.g. "authentication", "CORE"
  assigneeMention?: string; // e.g. "<@U12345>" or "U12345"
  priority?: TaskPriority;
  status?: TaskStatus;
  dueDate?: string; // ISO date string YYYY-MM-DD
  blockerReason?: string;
  rawText: string;
}

/**
 * Normalizes text by removing bot mention tags (e.g. `<@U0123456789>`) and excessive whitespace.
 */
export function cleanSlackText(text: string): string {
  return text.replace(/<@[A-Z0-9]+>/gi, '').trim();
}

/**
 * Extracts task identifier like "CORE-14" from text.
 */
export function extractTaskIdentifier(text: string): string | undefined {
  const match = text.match(/\b([A-Z]{2,6})-(\d+)\b/);
  return match ? `${match[1].toUpperCase()}-${match[2]}` : undefined;
}

/**
 * Extracts priority keywords: Urgent, High, Medium, Low.
 */
export function extractPriority(text: string): TaskPriority | undefined {
  if (/\b(urgent|critical|p0|blocker)\b/i.test(text)) return 'Urgent';
  if (/\b(high|p1|important)\b/i.test(text)) return 'High';
  if (/\b(medium|normal|p2)\b/i.test(text)) return 'Medium';
  if (/\b(low|minor|p3)\b/i.test(text)) return 'Low';
  return undefined;
}

/**
 * Extracts status keywords: Backlog, Todo, In Progress, In Review, Blocked, Done, Cancelled.
 */
export function extractStatus(text: string): TaskStatus | undefined {
  if (/\b(done|completed|finished|resolved|shipped)\b/i.test(text)) return 'Done';
  if (/\b(blocked|stuck)\b/i.test(text)) return 'Blocked';
  if (/\b(in\s*review|under\s*review|reviewing|pr\s*open)\b/i.test(text)) return 'In Review';
  if (/\b(in\s*progress|working\s*on\s*it|started|wip)\b/i.test(text)) return 'In Progress';
  if (/\b(to\s*do|todo)\b/i.test(text)) return 'Todo';
  if (/\b(backlog)\b/i.test(text)) return 'Backlog';
  if (/\b(cancelled|canceled|abandoned|dropped)\b/i.test(text)) return 'Cancelled';
  return undefined;
}

/**
 * Parses conversational dates such as "due tomorrow", "due Friday", "due 2026-10-31".
 */
export function extractDueDate(text: string, referenceDate: Date = new Date()): string | undefined {
  // 1. Explicit ISO date: YYYY-MM-DD
  const isoMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch) return isoMatch[1];

  // 2. "due today"
  if (/\bdue\s+today\b/i.test(text)) {
    return referenceDate.toISOString().split('T')[0];
  }

  // 3. "due tomorrow"
  if (/\bdue\s+tomorrow\b/i.test(text)) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }

  // 4. "due in X days"
  const inDaysMatch = text.match(/\bdue\s+in\s+(\d+)\s+days?\b/i);
  if (inDaysMatch) {
    const days = parseInt(inDaysMatch[1], 10);
    const d = new Date(referenceDate);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  // 5. "due Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday"
  const dayMatch = text.match(
    /\bdue\s+(next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i
  );
  if (dayMatch) {
    const targetDayName = dayMatch[2].toLowerCase();
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const targetDayIndex = daysOfWeek.indexOf(targetDayName);

    if (targetDayIndex !== -1) {
      const currentDayIndex = referenceDate.getDay();
      let diff = targetDayIndex - currentDayIndex;
      if (diff <= 0) diff += 7; // Next occurrence
      if (dayMatch[1]) diff += 7; // "next Friday"

      const d = new Date(referenceDate);
      d.setDate(d.getDate() + diff);
      return d.toISOString().split('T')[0];
    }
  }

  return undefined;
}

/**
 * Extracts project name or identifier hint from text.
 * e.g. "in project [CORE]", "for the auth project", "project: backend"
 */
export function extractProjectHint(text: string): string | undefined {
  // Explicit "project: XYZ" or "[XYZ]"
  const bracketMatch = text.match(/\[([A-Z]{2,6})\]/);
  if (bracketMatch) return bracketMatch[1];

  const projectTagMatch = text.match(/\bproject[:\s]+(["']?)([\w\s-]+?)\1(?=[,;]|$|\s+due|\s+priority|\s+with|\s+assign)/i);
  if (projectTagMatch) return projectTagMatch[2].trim();

  const toProjectMatch = text.match(/\b(?:to|in|for)\s+the\s+([\w\s-]+?)\s+project\b/i);
  if (toProjectMatch) return toProjectMatch[1].trim();

  return undefined;
}

/**
 * Extracts assignee mention (e.g. `<@U12345678>`).
 */
export function extractAssigneeMention(text: string): string | undefined {
  const match = text.match(/<@([A-Z0-9]+)>/i);
  return match ? match[1] : undefined;
}

/**
 * Primary deterministic parser for conversational Slack messages.
 */
export function parseSlackMessage(
  text: string,
  referenceDate: Date = new Date()
): ParsedSlackCommand {
  const clean = cleanSlackText(text);

  // 1. Help intent
  if (/^(help|\?|commands|what can you do)/i.test(clean) || /\bhelp\b/i.test(clean)) {
    return {
      intent: 'help',
      rawText: text,
    };
  }

  const existingTaskId = extractTaskIdentifier(clean);

  // 2. Status update on existing task (e.g. "CORE-14 is Done", "mark CORE-14 as completed", "status CORE-14 in progress")
  if (existingTaskId) {
    const status = extractStatus(clean);
    const isBlocker = /\b(blocked|blocker)\b/i.test(clean);

    if (isBlocker) {
      // Extract blocker explanation
      const blockerReason = clean.replace(/^[A-Z0-9-]+\s*(is\s*)?/i, '').trim();
      return {
        intent: 'report_blocker',
        taskIdentifier: existingTaskId,
        status: 'Blocked',
        blockerReason: blockerReason || 'Blocked (reported via Slack)',
        rawText: text,
      };
    }

    if (status) {
      return {
        intent: 'update_status',
        taskIdentifier: existingTaskId,
        status,
        rawText: text,
      };
    }

    // Default to comment on task if mentioning an existing task
    return {
      intent: 'add_comment',
      taskIdentifier: existingTaskId,
      description: clean,
      rawText: text,
    };
  }

  // 3. Task Creation intent
  const isCreateRequest =
    /\b(create|add|new)\s+(a\s+)?task\b/i.test(clean) ||
    /^(task:|create:)/i.test(clean);

  if (isCreateRequest) {
    // Extract priority, due date, project, assignee
    const priority = extractPriority(clean) || 'Medium';
    const dueDate = extractDueDate(clean, referenceDate);
    const projectNameHint = extractProjectHint(clean);
    const assigneeMention = extractAssigneeMention(text);

    // Extract title: remove creation prefix and modifiers
    let title = clean
      .replace(/^(please\s+)?(create|add|new)\s+(a\s+)?task\s+(to|for|about)?/i, '')
      .replace(/^task:\s*/i, '')
      .replace(/\s+in\s+(the\s+)?[\w\s-]+?\s+project\b/i, '')
      .replace(/\s+project[:\s]+[\w\s-]+/i, '')
      .replace(/\[[A-Z]{2,6}\]/g, '')
      .replace(/\s+due\s+(tomorrow|today|in\s+\d+\s+days?|next\s+\w+|\w+|\d{4}-\d{2}-\d{2})/i, '')
      .replace(/\s+priority[:\s]+(urgent|high|medium|low)/i, '')
      .replace(/\s+(urgent|high|medium|low)\s+priority/i, '')
      .replace(/\s+(assign(ed)?\s+to\s+)?<@[A-Z0-9]+>/gi, '')
      .trim();

    // Clean up trailing commas or punctuation
    title = title.replace(/^["']|["']$/g, '').replace(/[,;.]+$/, '').trim();

    if (!title) {
      title = 'Untitled Task';
    }

    return {
      intent: 'create_task',
      title,
      priority,
      dueDate,
      projectNameHint,
      assigneeMention,
      rawText: text,
    };
  }

  // 4. Standalone status/blocker reply without explicit task ID (e.g. in a thread)
  const standaloneStatus = extractStatus(clean);
  if (standaloneStatus) {
    return {
      intent: 'update_status',
      status: standaloneStatus,
      description: clean,
      rawText: text,
    };
  }

  // 5. Unknown/ambiguous input
  return {
    intent: 'unknown',
    rawText: text,
    description: clean,
  };
}
