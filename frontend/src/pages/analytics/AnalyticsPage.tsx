// 🎬 CineStudy Analytics - Coming Soon

import React from 'react';
import Card from '../../components/ui/Card';
import { BarChart3 } from 'lucide-react';

const AnalyticsPage: React.FC = () => {
  return (
    <div className="text-center py-12">
      <Card>
        <BarChart3 className="w-16 h-16 text-primary-600 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          📊 Analytics Coming Soon!
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Detailed insights into your study patterns, progress trends, and performance optimization.
        </p>
      </Card>
    </div>
  );
};

export default AnalyticsPage;
