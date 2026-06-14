// Re-exports from @glance-apps/sync.
// dayGLANCE tasks use `lastModified` for the per-item timestamp, so
// mergeTaskArrays pins timestampField rather than re-exporting the alias
// directly (which would default to `updatedAt`).
import { mergeArrayById, mergeSyncData as _mergeSyncData } from '@glance-apps/sync';

export const mergeTaskArrays = (local, remote, deletedIds, syncHorizon = null) =>
  mergeArrayById(local, remote, deletedIds, syncHorizon, { timestampField: 'lastModified' });

export {
  mergeDailyNotes,
  mergeHabits,
  mergeHabitLogs,
  mergeRoutineDefinitions,
  pruneTombstones,
} from '@glance-apps/sync';

// @glance-apps/sync's mergeSyncData intentionally omits the multi-user roster
// (`users`) and the `multiUserEnabled` flag from its merged output. Because every
// sync round-trip merges then writes the result back, those fields get *stripped*
// on every device — so the roster never propagates even though tasks do. Wrap the
// upstream merge to re-merge them: last-write-wins per user by `updatedAt`, and the
// enabled flag by its `multiUserEnabledUpdatedAt` timestamp. localChanged /
// remoteChanged are updated so the sync engine still applies/writes when only the
// roster (and not tasks) changed.
const rosterKey = (u) => u.syncId ?? u.id;
const rosterSig = (u) => `${u.updatedAt || ''}|${u.deleted ? 1 : 0}|${u.name || ''}`;

const sameRoster = (a, b) => {
  if (a.length !== b.length) return false;
  const m = new Map(b.map(u => [rosterKey(u), rosterSig(u)]));
  return a.every(u => m.get(rosterKey(u)) === rosterSig(u));
};

export const mergeSyncData = (localData = {}, remoteData = {}, retentionDays = 90) => {
  const result = _mergeSyncData(localData, remoteData, retentionDays);

  // Multi-user roster: last-write-wins per user (keyed by syncId, falling back to id).
  const localUsers = Array.isArray(localData.users) ? localData.users : [];
  const remoteUsers = Array.isArray(remoteData.users) ? remoteData.users : [];
  if (localUsers.length || remoteUsers.length) {
    const byId = new Map(localUsers.map(u => [rosterKey(u), u]));
    for (const u of remoteUsers) {
      const k = rosterKey(u);
      const existing = byId.get(k);
      if (!existing || (u.updatedAt || '') > (existing.updatedAt || '')) byId.set(k, u);
    }
    const mergedUsers = [...byId.values()];
    result.data.users = mergedUsers;
    if (!sameRoster(mergedUsers, localUsers)) result.localChanged = true;
    if (!sameRoster(mergedUsers, remoteUsers)) result.remoteChanged = true;
  }

  // multiUserEnabled flag: last-write-wins by its own timestamp.
  const lt = localData.multiUserEnabledUpdatedAt || '';
  const rt = remoteData.multiUserEnabledUpdatedAt || '';
  if (lt || rt) {
    const remoteWins = rt > lt;
    result.data.multiUserEnabled = remoteWins ? remoteData.multiUserEnabled : localData.multiUserEnabled;
    result.data.multiUserEnabledUpdatedAt = remoteWins ? rt : lt;
    if (result.data.multiUserEnabled !== localData.multiUserEnabled) result.localChanged = true;
    if (result.data.multiUserEnabled !== remoteData.multiUserEnabled) result.remoteChanged = true;
  }

  return result;
};
