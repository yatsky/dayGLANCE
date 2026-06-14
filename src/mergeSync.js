// Re-exports from @glance-apps/sync.
// dayGLANCE tasks use `lastModified` for the per-item timestamp, so
// mergeTaskArrays pins timestampField rather than re-exporting the alias
// directly (which would default to `updatedAt`).
import { mergeArrayById } from '@glance-apps/sync';

export const mergeTaskArrays = (local, remote, deletedIds, syncHorizon = null) =>
  mergeArrayById(local, remote, deletedIds, syncHorizon, { timestampField: 'lastModified' });

// mergeSyncData (since @glance-apps/sync v1.3.0) merges the multi-user roster
// (`users`, last-write-wins per user keyed by `syncId`) while deliberately
// leaving the per-device `multiUserEnabled` toggle alone. dayGLANCE previously
// wrapped this function to patch the roster in; that stopgap is no longer
// needed — the upstream merge covers every sync path directly.
export {
  mergeDailyNotes,
  mergeHabits,
  mergeHabitLogs,
  mergeRoutineDefinitions,
  mergeSyncData,
  pruneTombstones,
} from '@glance-apps/sync';
