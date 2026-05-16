# lifeGLANCE — `@glance-apps/sync` Integration Guide

> **Note**: This document lives in the dayGLANCE repo temporarily (alongside the package spec).
> **Transfer this file to the lifeGLANCE repository** before integration work begins.
> Suggested path: `docs/SYNC_INTEGRATION.md`

---

## Overview

lifeGLANCE is a React + localStorage app (similar architecture to dayGLANCE). It tracks life entries — journal-like records that may include photos, mood, tags, and timestamps.

This guide describes how to add `@glance-apps/sync` to lifeGLANCE.

---

## lifeGLANCE Config Values

```js
{
  storageKeyPrefix: 'lifeglance',
  cryptoDBName: 'lifeglance-crypto',
  autoBackupDBName: 'lifeglance-auto-backups',
  syncFilename: 'lifeglance-sync.json',
  appFolderName: 'lifeglance',
  backupFilenamePrefix: 'lifeglance-backup-',
  appId: 'lifeglance',
  appName: 'lifeGLANCE',
}
```

---

## Prerequisite: ID Strategy

Verify that life entries already use UUIDs as primary identifiers. If they use auto-increment integers, add a `sync_id` UUID field (see ADAPTER_GUIDE.md, Step 1).

Every syncable item must also have an `updatedAt` ISO string timestamp. If entries have only `createdAt`, add `updatedAt` (defaulting to `createdAt` for existing records).

---

## Payload Shape

Design the payload to include all syncable data:

```js
{
  entries: [
    {
      id: 'uuid-...',
      date: '2026-05-16',
      text: 'Had a great walk this morning.',
      mood: 4,
      tags: ['exercise', 'morning'],
      // photo metadata only — not the blob
      photo: { filename: 'photo-2026-05-16.jpg', size: 204800, hash: 'sha256-...' },
      updatedAt: '2026-05-16T10:00:00Z',
      createdAt: '2026-05-16T08:00:00Z',
    }
  ],
  tombstones: {
    'uuid-deleted-entry': '2026-05-15T08:00:00Z',
  }
}
```

---

## Binary Data (Photos)

**Photos must not be included in the sync payload.** They are excluded at the adapter boundary.

### In `buildPayload`

Strip the binary blob from each entry. Keep only the metadata (filename, size, hash) needed to detect changes:

```js
const buildPayload = () => {
  const entries = entriesRef.current;
  return {
    entries: entries.map(({ photo_blob, photo_data, ...rest }) => rest),
    tombstones: JSON.parse(localStorage.getItem('lifeglance-tombstones') || '{}'),
  };
};
```

The `photo` field in the payload contains only `{ filename, size, hash }`. Photo blobs sync out of band (or not at all — user decision).

### Tombstones

When an entry with a photo is deleted, write a tombstone for the entry as usual. The photo blob should be deleted locally by the app. No special sync handling needed for the blob.

---

## `buildPayload`

```js
const buildPayload = () => ({
  entries: entriesRef.current.map(({ photo_blob, ...rest }) => rest),
  tombstones: JSON.parse(localStorage.getItem('lifeglance-tombstones') || '{}'),
});
```

---

## `buildBackupPayload`

Timer-safe version — read from localStorage only:

```js
const buildBackupPayload = () => {
  const raw = localStorage.getItem('lifeglance-entries');
  const entries = raw ? JSON.parse(raw) : [];
  return {
    entries: entries.map(({ photo_blob, ...rest }) => rest),
    tombstones: JSON.parse(localStorage.getItem('lifeglance-tombstones') || '{}'),
  };
};
```

---

## `applyPayload`

```js
const applyPayload = async (data) => {
  // Preserve local photo blobs — remote payload has metadata only
  const localEntries = entriesRef.current;
  const localBlobMap = Object.fromEntries(
    localEntries.filter(e => e.photo_blob).map(e => [e.id, e.photo_blob])
  );

  // Merge photo blobs back into applied entries
  const entries = data.entries.map(e => ({
    ...e,
    photo_blob: localBlobMap[e.id] ?? null,
  }));

  localStorage.setItem('lifeglance-entries', JSON.stringify(entries));
  localStorage.setItem('lifeglance-tombstones', JSON.stringify(data.tombstones));
  setEntries(entries);
};
```

This ensures local photo blobs are not lost when remote data is applied. The payload has no blobs; the local blob is re-attached after merge.

---

## Merge Orchestrator

```js
import { mergeArrayById, pruneTombstones } from '@glance-apps/sync';

const mergePayloads = (local, remote) => {
  const tombstones = pruneTombstones(
    { ...local.tombstones, ...remote.tombstones },
    90
  );
  return {
    entries: mergeArrayById(local.entries, remote.entries, tombstones, {
      idField: 'id',
      timestampField: 'updatedAt',
    }),
    tombstones,
  };
};
```

---

## Engine Setup

```js
import { createSyncEngine } from '@glance-apps/sync';
import { nativeHttpRequest } from './native.js';  // if lifeGLANCE has a native bridge

const engine = createSyncEngine({
  storageKeyPrefix: 'lifeglance',
  cryptoDBName: 'lifeglance-crypto',
  autoBackupDBName: 'lifeglance-auto-backups',
  syncFilename: 'lifeglance-sync.json',
  appFolderName: 'lifeglance',
  backupFilenamePrefix: 'lifeglance-backup-',
  appId: 'lifeglance',
  appName: 'lifeGLANCE',

  buildPayload,
  buildBackupPayload,
  applyPayload,
  mergePayloads,

  nativeHttpRequest,  // pass only if native HTTP bridge exists
  proxyUrl: import.meta.env.VITE_WEBDAV_PROXY_URL,

  onStatusChange: setSyncStatus,
  onError: (msg, code, isHardStop) => {
    setSyncError(msg);
    if (isHardStop) setSyncHalted(true);
  },
  onLastSyncedChange: setLastSynced,
  onPassphraseRequired: () => setShowPassphraseModal(true),
});
```

---

## CORS Proxy

Copy `api/webdav-proxy.js` from `@glance-apps/sync` into lifeGLANCE's `api/` directory. Deploy to Vercel under a lifeGLANCE-specific project.

Set `VITE_WEBDAV_PROXY_URL` in Vercel environment variables to your deployment URL.

---

## UI Components

The following components from dayGLANCE can be copied and adapted for lifeGLANCE with minimal changes:

- `CloudSyncSettingsForm.jsx` — provider config, encryption setup
- `SyncPassphraseModal.jsx` — passphrase entry
- `BackupMenuModal.jsx` / `AutoBackupSettingsForm.jsx` — backup management

These accept state/callbacks as props. Wire them to lifeGLANCE's state and the engine's `getConfig()` / `setConfig()` methods.

---

## Verification Checklist

- [ ] Entry created on Device A appears on Device B after sync
- [ ] Entry deleted on Device A is tombstoned and removed on Device B
- [ ] Photo blob is preserved on Device A after applying remote payload (not overwritten with null)
- [ ] Photo is not present in the sync file on WebDAV
- [ ] Conflict: same entry modified on two devices → later `updatedAt` wins
- [ ] Encryption: enable, reload, re-enter passphrase, verify entries decrypt
- [ ] Hard-stop error persists in UI (not auto-cleared)
- [ ] Auto-backup appears in lifeGLANCE Nextcloud folder (separate from dayGLANCE)
