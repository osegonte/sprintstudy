// 🎬 CineStudy Sprints - Coming Soon

import React from 'react';
import Card from '../../components/ui/Card';
import { Target } from 'lucide-react';

const SprintsPage: React.FC = () => {
  return (
    <div className="text-center py-12">
      <Card>
        <Target className="w-16 h-16 text-primary-600 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          🎯 Sprints Coming Soon!
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Focused study sessions with real-time tracking and anti-procrastination features.
        </p>
      </Card>
    </div>
  );
};

export default SprintsPage;
