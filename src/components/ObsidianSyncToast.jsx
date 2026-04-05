import React from 'react';
import { BookOpen, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { useSyncCtx } from '../context/SyncContext.jsx';
import { useDayPlannerCtx } from '../context/DayPlannerContext.jsx';

const ObsidianSyncToast = () => {
  const { obsidianSyncStatus, obsidianSyncError } = useSyncCtx();
  const { cardBg, borderClass, textPrimary, textSecondary, darkMode } = useDayPlannerCtx();

  if (obsidianSyncStatus === 'idle') return null;

  const isSyncing = obsidianSyncStatus === 'syncing';
  const isSuccess = obsidianSyncStatus === 'success';
  const isError = obsidianSyncStatus === 'error';

  let icon, message, accentColor;
  if (isSyncing) {
    icon = <Loader size={16} className="text-blue-500 animate-spin flex-shrink-0" />;
    message = 'Building Obsidian vault index…';
    accentColor = 'bg-blue-500';
  } else if (isSuccess) {
    icon = <CheckCircle size={16} className="text-green-500 flex-shrink-0" />;
    message = 'Obsidian vault synced';
    accentColor = 'bg-green-500';
  } else {
    icon = <AlertCircle size={16} className="text-red-500 flex-shrink-0" />;
    message = obsidianSyncError || 'Obsidian sync failed';
    accentColor = 'bg-red-500';
  }

  return (
    <div className="fixed bottom-6 left-6 z-50 animate-in slide-in-from-bottom-2 duration-200">
      <div className={`flex items-center gap-3 ${cardBg} border ${borderClass} rounded-xl shadow-xl px-4 py-3 max-w-xs`}>
        <div className={`w-1.5 self-stretch rounded-full flex-shrink-0 ${accentColor}`} />
        {icon}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${textPrimary}`}>{message}</p>
          {isSyncing && (
            <p className={`text-xs ${textSecondary} mt-0.5`}>The app may be slow for a moment</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ObsidianSyncToast;
