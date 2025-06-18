// src/pages/analytics/AnalyticsPage.tsx
import React from 'react';
import { BarChart3 } from 'lucide-react';

const AnalyticsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center">
          <BarChart3 className="w-16 h-16 text-purple-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics</h1>
          <p className="text-gray-600">View your study analytics here</p>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;