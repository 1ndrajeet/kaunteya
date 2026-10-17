import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getProjectDeadlineStatus } from '../../types/database';

describe('Project Deadline and Lifecycle Status Evaluator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Fix current time to 2026-10-17 12:00:00 UTC
    vi.setSystemTime(new Date('2026-10-17T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Completed Projects', () => {
    it('returns completed_on_time when completed_at is before or on target_date', () => {
      const result = getProjectDeadlineStatus({
        status: 'completed',
        target_date: '2026-10-20',
        completed_at: '2026-10-19T10:00:00Z',
      });

      expect(result.status).toBe('completed_on_time');
      expect(result.label).toBe('Completed On Time');
      expect(result.badgeClass).toContain('text-emerald-400');
    });

    it('returns completed_late when completed_at is after target_date (+ buffer)', () => {
      const result = getProjectDeadlineStatus({
        status: 'completed',
        target_date: '2026-10-10',
        completed_at: '2026-10-15T10:00:00Z',
      });

      expect(result.status).toBe('completed_late');
      expect(result.label).toBe('Completed Late');
      expect(result.badgeClass).toContain('text-amber-400');
    });

    it('returns on_track / Completed when completed with no target date', () => {
      const result = getProjectDeadlineStatus({
        status: 'completed',
        target_date: null,
      });

      expect(result.status).toBe('on_track');
      expect(result.label).toBe('Completed');
    });
  });

  describe('Archived and Paused Projects', () => {
    it('returns no_deadline with Archived label for archived projects', () => {
      const result = getProjectDeadlineStatus({
        status: 'archived',
        target_date: '2026-10-01', // Past date should NOT show overdue if archived
      });

      expect(result.status).toBe('no_deadline');
      expect(result.label).toBe('Archived');
    });

    it('returns no_deadline with Paused label for paused projects', () => {
      const result = getProjectDeadlineStatus({
        status: 'paused',
        target_date: '2026-10-01',
      });

      expect(result.status).toBe('no_deadline');
      expect(result.label).toBe('Paused');
    });
  });

  describe('Active Projects without Target Date', () => {
    it('returns no_deadline when target_date is not set', () => {
      const result = getProjectDeadlineStatus({
        status: 'active',
        target_date: null,
      });

      expect(result.status).toBe('no_deadline');
      expect(result.label).toBe('No Deadline');
    });
  });

  describe('Active Projects with Target Dates', () => {
    it('returns overdue when target_date has passed', () => {
      const result = getProjectDeadlineStatus({
        status: 'active',
        target_date: '2026-10-10', // 7 days ago relative to 2026-10-17
      });

      expect(result.status).toBe('overdue');
      expect(result.label).toContain('Overdue');
      expect(result.badgeClass).toContain('text-rose-400');
    });

    it('returns closing_soon when target_date is within 1 to 3 days', () => {
      const result = getProjectDeadlineStatus({
        status: 'active',
        target_date: '2026-10-19', // ~2 days from 2026-10-17
      });

      expect(result.status).toBe('closing_soon');
      expect(result.label).toContain('Closing Soon');
      expect(result.badgeClass).toContain('text-amber-400');
    });

    it('returns deadline_approaching when target_date is between 4 and 7 days', () => {
      const result = getProjectDeadlineStatus({
        status: 'active',
        target_date: '2026-10-23', // 6 days from 2026-10-17
      });

      expect(result.status).toBe('deadline_approaching');
      expect(result.label).toContain('Due in');
      expect(result.badgeClass).toContain('text-indigo-400');
    });

    it('returns on_track when target_date is more than 7 days away', () => {
      const result = getProjectDeadlineStatus({
        status: 'active',
        target_date: '2026-11-15', // 29 days away
      });

      expect(result.status).toBe('on_track');
      expect(result.label).toContain('On Track');
      expect(result.badgeClass).toContain('text-zinc-300');
    });
  });
});
