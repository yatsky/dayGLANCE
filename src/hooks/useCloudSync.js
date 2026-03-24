import { useState, useRef, useEffect } from 'react';

const useCloudSync = () => {
  const [cloudSyncConfig, setCloudSyncConfig] = useState(() => {
    const saved = localStorage.getItem('day-planner-cloud-sync-config');
    return saved ? JSON.parse(saved) : null;
  });
  const [cloudSyncStatus, setCloudSyncStatus] = useState('idle');
  const [cloudSyncError, setCloudSyncError] = useState(null);
  const [cloudSyncLastSynced, setCloudSyncLastSynced] = useState(() =>
    localStorage.getItem('day-planner-cloud-sync-last-synced') || null
  );
  const [cloudSyncConflict, setCloudSyncConflict] = useState(null); // { remoteData, remoteModified }
  const cloudSyncDebounceRef = useRef(null);
  const suppressCloudUploadRef = useRef(false);
  const suppressTimestampRef = useRef(false);
  const suppressClearPendingRef = useRef(false);
  const cloudSyncInProgressRef = useRef(false);
  const cloudSyncInitialDoneRef = useRef(false);
  const cloudSyncDownloadRef = useRef(null);
  const cloudSyncErrorCountRef = useRef(0); // consecutive download failures
  const cloudSyncBackoffUntilRef = useRef(0); // timestamp: skip poll/visibility retries until this time

  // Persist cloud sync config
  useEffect(() => {
    if (cloudSyncConfig) {
      localStorage.setItem('day-planner-cloud-sync-config', JSON.stringify(cloudSyncConfig));
    } else {
      localStorage.removeItem('day-planner-cloud-sync-config');
    }
  }, [cloudSyncConfig]);

  return {
    cloudSyncConfig, setCloudSyncConfig,
    cloudSyncStatus, setCloudSyncStatus,
    cloudSyncError, setCloudSyncError,
    cloudSyncLastSynced, setCloudSyncLastSynced,
    cloudSyncConflict, setCloudSyncConflict,
    cloudSyncDebounceRef,
    suppressCloudUploadRef,
    suppressTimestampRef,
    suppressClearPendingRef,
    cloudSyncInProgressRef,
    cloudSyncInitialDoneRef,
    cloudSyncDownloadRef,
    cloudSyncErrorCountRef,
    cloudSyncBackoffUntilRef,
  };
};

export default useCloudSync;
