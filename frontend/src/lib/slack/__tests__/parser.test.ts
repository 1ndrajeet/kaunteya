import { describe, it, expect } from 'vitest';
import { parseSlackMessage, extractDueDate } from '../parser';

describe('parseSlackMessage', () => {
  const refDate = new Date('2026-10-16T12:00:00Z'); // A Friday

  it('parses explicit task creation request correctly', () => {
    const message =
      '<@U0BOT123> create a task to add password reset support to the authentication project, high priority, due Friday';

    const parsed = parseSlackMessage(message, refDate);

    expect(parsed.intent).toBe('create_task');
    expect(parsed.title).toContain('add password reset support');
    expect(parsed.priority).toBe('High');
    expect(parsed.dueDate).toBeDefined();
  });

  it('extracts priority levels accurately', () => {
    expect(parseSlackMessage('new task fix critical memory leak urgent', refDate).priority).toBe('Urgent');
    expect(parseSlackMessage('create task update docs low priority', refDate).priority).toBe('Low');
    expect(parseSlackMessage('create a task migrate database medium priority', refDate).priority).toBe('Medium');
  });

  it('extracts ISO due date and relative dates', () => {
    const isoResult = parseSlackMessage('create task release v1 due 2026-11-15', refDate);
    expect(isoResult.dueDate).toBe('2026-11-15');

    const tomorrow = extractDueDate('due tomorrow', refDate);
    expect(tomorrow).toBe('2026-10-17');

    const inThreeDays = extractDueDate('due in 3 days', refDate);
    expect(inThreeDays).toBe('2026-10-19');
  });

  it('extracts assignee mention when tagged', () => {
    const message = 'create task fix login bug assign to <@U999888>';
    const parsed = parseSlackMessage(message, refDate);

    expect(parsed.intent).toBe('create_task');
    expect(parsed.assigneeMention).toBe('U999888');
  });

  it('parses status updates on existing task', () => {
    const parsed = parseSlackMessage('CORE-14 is Done', refDate);
    expect(parsed.intent).toBe('update_status');
    expect(parsed.taskIdentifier).toBe('CORE-14');
    expect(parsed.status).toBe('Done');

    const wip = parseSlackMessage('WEB-5 in progress', refDate);
    expect(wip.intent).toBe('update_status');
    expect(wip.taskIdentifier).toBe('WEB-5');
    expect(wip.status).toBe('In Progress');
  });

  it('parses blocker reports on existing task', () => {
    const parsed = parseSlackMessage('CORE-14 is blocked waiting on upstream API key', refDate);
    expect(parsed.intent).toBe('report_blocker');
    expect(parsed.taskIdentifier).toBe('CORE-14');
    expect(parsed.status).toBe('Blocked');
    expect(parsed.blockerReason).toContain('waiting on upstream API key');
  });

  it('recognizes help command', () => {
    expect(parseSlackMessage('help', refDate).intent).toBe('help');
    expect(parseSlackMessage('<@UBOT> commands', refDate).intent).toBe('help');
  });

  it('categorizes ambiguous messages as unknown for safe clarification', () => {
    const parsed = parseSlackMessage('Hey team, sounds good!', refDate);
    expect(parsed.intent).toBe('unknown');
  });
});
