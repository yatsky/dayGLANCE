import React, { useState } from 'react';
import { cloudSyncProviders } from '../utils/cloudSyncProviders.js';

// Cloud sync settings form (extracted to avoid hooks-in-conditional issues)
const CloudSyncSettingsForm = ({ darkMode, textPrimary, textSecondary, borderClass, hoverBg, cloudSyncConfig, setCloudSyncConfig, cloudSyncTest, provider, currentProvider, onClose, cloudSyncLastSynced }) => {
  const [formData, setFormData] = useState(() => {
    const initial = { provider: currentProvider };
    // Populate fields from all providers so switching preserves filled values
    Object.values(cloudSyncProviders).forEach(p => {
      p.configFields.forEach(f => { initial[f.key] = cloudSyncConfig?.[f.key] || ''; });
    });
    return initial;
  });
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  const activeProvider = cloudSyncProviders[formData.provider] || provider;
  const requiredFieldsFilled = activeProvider.configFields.every(f => formData[f.key]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await cloudSyncTest({ ...formData, provider: formData.provider });
    setTestResult(result);
    setTesting(false);
  };

  const handleSave = () => {
    setCloudSyncConfig({ ...formData, provider: formData.provider, enabled: true });
    onClose();
  };

  const handleDisable = () => {
    setCloudSyncConfig({ ...cloudSyncConfig, enabled: false });
    onClose();
  };

  return (
    <div className="space-y-4">
      <div>
        <label className={`block text-sm font-medium ${textSecondary} mb-1`}>Provider</label>
        <select
          value={formData.provider}
          onChange={(e) => setFormData(prev => ({ ...prev, provider: e.target.value }))}
          className={`w-full px-3 py-2 border ${borderClass} rounded-lg ${darkMode ? 'bg-gray-700 text-white' : 'bg-stone-100 text-stone-900'}`}
        >
          {Object.entries(cloudSyncProviders).map(([key, p]) => (
            <option key={key} value={key}>{p.name}</option>
          ))}
        </select>
      </div>

      {activeProvider.configFields.map(field => (
        <div key={field.key}>
          <label className={`block text-sm font-medium ${textSecondary} mb-1`}>{field.label}</label>
          <input
            type={field.type}
            placeholder={field.placeholder}
            value={formData[field.key] || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
            className={`w-full px-3 py-2 border ${borderClass} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${darkMode ? 'bg-gray-700 text-white' : 'bg-white text-stone-900'}`}
          />
          {field.type === 'password' && (
            <p className={`text-xs ${textSecondary} mt-0.5`}>Stored in browser localStorage — keep your device secure.</p>
          )}
        </div>
      ))}

      {activeProvider.helpText && (
        <p className={`text-xs ${textSecondary}`}>{activeProvider.helpText}</p>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={handleTest}
          disabled={testing || !requiredFieldsFilled}
          className={`px-4 py-2 ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-stone-200 hover:bg-stone-300'} ${textPrimary} rounded-lg transition-colors disabled:opacity-50`}
        >
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
        {testResult && (
          <span className={`text-sm ${testResult.success ? 'text-green-500' : 'text-red-500'}`}>
            {testResult.success ? 'Connection successful!' : testResult.error}
          </span>
        )}
      </div>

      {cloudSyncLastSynced && (
        <p className={`text-xs ${textSecondary}`}>
          Last synced: {new Date(cloudSyncLastSynced).toLocaleString()}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onClose}
          className={`px-4 py-2 ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-stone-200 hover:bg-stone-300'} ${textPrimary} rounded-lg transition-colors`}
        >
          Cancel
        </button>
        {cloudSyncConfig?.enabled && (
          <button
            onClick={handleDisable}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Disable
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={!requiredFieldsFilled}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {cloudSyncConfig?.enabled ? 'Save' : 'Save & Enable'}
        </button>
      </div>
    </div>
  );
};

export default CloudSyncSettingsForm;
