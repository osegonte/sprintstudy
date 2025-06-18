// src/pages/settings/SettingsPage.tsx
import React from 'react';
import { Settings } from 'lucide-react';

const SettingsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center">
          <Settings className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600">Manage your account settings here</p>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;