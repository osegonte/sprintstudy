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

// src/pages/documents/DocumentsPage.tsx
import React from 'react';
import { FileText } from 'lucide-react';

const DocumentsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center">
          <FileText className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Documents</h1>
          <p className="text-gray-600">Manage your study documents here</p>
        </div>
      </div>
    </div>
  );
};

export default DocumentsPage;

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