// 🎬 CineStudy Topics - Coming Soon

import React from 'react';
import Card from '../../components/ui/Card';
import { FolderOpen } from 'lucide-react';

const TopicsPage: React.FC = () => {
  return (
    <div className="text-center py-12">
      <Card>
        <FolderOpen className="w-16 h-16 text-primary-600 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          📂 Topics Coming Soon!
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Organize your studies by subject with progress tracking and exam countdown.
        </p>
      </Card>
    </div>
  );
};

export default TopicsPage;
