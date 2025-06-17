// 🎬 CineStudy Settings - Coming Soon

import React from 'react';
import Card from '../../components/ui/Card';
import { Settings } from 'lucide-react';

const SettingsPage: React.FC = () => {
  return (
    <div className="text-center py-12">
      <Card>
        <Settings className="w-16 h-16 text-primary-600 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          ⚙️ Settings Coming Soon!
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Customize your CineStudy experience with themes, notifications, and study preferences.
        </p>
      </Card>
    </div>
  );
};

export default SettingsPage;
