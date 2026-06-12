import { describe, it, expect } from 'vitest';
import { computeTaskCalendarTombstones } from './taskUtils.js';

// A synced (non-file) CalDAV task-calendar item as produced by expandMultiDayEvent.
const tcItem = (id, date, extra = {}) => ({
  id,
  date,
  isTaskCalendar: true,
  imported: true,
  importSource: 'sync',
  ...extra,
});

describe('computeTaskCalendarTombstones', () => {
  it('tombstones a non-recurring item that disappeared from the feed', () => {
    const prior = [tcItem('uid-a-2026-06-10', '2026-06-10'), tcItem('uid-b-2026-06-11', '2026-06-11')];
    const fresh = [tcItem('uid-a-2026-06-10', '2026-06-10')]; // uid-b deleted on server
    expect(computeTaskCalendarTombstones(prior, fresh)).toEqual(['uid-b-2026-06-11']);
  });

  it('returns [] when every prior item is still present', () => {
    const prior = [tcItem('uid-a-2026-06-10', '2026-06-10')];
    const fresh = [tcItem('uid-a-2026-06-10', '2026-06-10')];
    expect(computeTaskCalendarTombstones(prior, fresh)).toEqual([]);
  });

  it('treats a moved item (new date => new id) as a deletion of the old id', () => {
    const prior = [tcItem('uid-a-2026-06-10', '2026-06-10')];
    const fresh = [tcItem('uid-a-2026-06-12', '2026-06-12')]; // same VTODO, moved
    expect(computeTaskCalendarTombstones(prior, fresh)).toEqual(['uid-a-2026-06-10']);
  });

  it('skips tombstoning entirely when the fresh feed is empty (transient-glitch guard)', () => {
    const prior = [tcItem('uid-a-2026-06-10', '2026-06-10'), tcItem('uid-b-2026-06-11', '2026-06-11')];
    expect(computeTaskCalendarTombstones(prior, [])).toEqual([]);
  });

  it('never tombstones recurring-series items (v1 scope)', () => {
    const prior = [tcItem('uid-r-2026-06-10', '2026-06-10', { isRecurringSeries: true })];
    const fresh = [tcItem('uid-other-2026-06-10', '2026-06-10')]; // recurring occurrence not in fresh
    expect(computeTaskCalendarTombstones(prior, fresh)).toEqual([]);
  });

  it('ignores non-task-calendar tasks and file imports', () => {
    const prior = [
      { id: 'regular-1', date: '2026-06-10' }, // user task
      tcItem('file-1', '2026-06-10', { importSource: 'file' }), // ICS file import
      tcItem('read-only-1', '2026-06-10', { isTaskCalendar: false }), // read-only calendar event
    ];
    const fresh = [tcItem('something-else', '2026-06-10')];
    expect(computeTaskCalendarTombstones(prior, fresh)).toEqual([]);
  });

  it('only tombstones items within the retention window', () => {
    const prior = [
      tcItem('uid-old-2026-01-01', '2026-01-01'), // before cutoff
      tcItem('uid-new-2026-06-10', '2026-06-10'), // within window
    ];
    const fresh = [tcItem('uid-keep-2026-06-09', '2026-06-09')]; // both prior items gone
    const result = computeTaskCalendarTombstones(prior, fresh, { cutoffDateStr: '2026-05-13' });
    expect(result).toEqual(['uid-new-2026-06-10']);
  });

  it('considers all items when no cutoff is given', () => {
    const prior = [tcItem('uid-old-2020-01-01', '2020-01-01')];
    const fresh = [tcItem('uid-other', '2026-06-10')];
    expect(computeTaskCalendarTombstones(prior, fresh, { cutoffDateStr: null })).toEqual(['uid-old-2020-01-01']);
  });

  it('handles empty/invalid prior input gracefully', () => {
    expect(computeTaskCalendarTombstones([], [tcItem('a', '2026-06-10')])).toEqual([]);
    expect(computeTaskCalendarTombstones(null, [tcItem('a', '2026-06-10')])).toEqual([]);
  });
});
