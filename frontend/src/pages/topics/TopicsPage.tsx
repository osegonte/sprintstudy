// src/pages/topics/TopicsPage.tsx
import React from 'react';
import { BookOpen } from 'lucide-react';

const TopicsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center">
          <BookOpen className="w-16 h-16 text-blue-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Topics</h1>
          <p className="text-gray-600">Manage your study topics here</p>
        </div>
      </div>
    </div>
  );
};

export default TopicsPage;