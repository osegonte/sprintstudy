// 🎬 CineStudy Documents - Coming Soon

import React from 'react';
import Card from '../../components/ui/Card';
import { FileText } from 'lucide-react';

const DocumentsPage: React.FC = () => {
  return (
    <div className="text-center py-12">
      <Card>
        <FileText className="w-16 h-16 text-primary-600 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          📄 Documents Coming Soon!
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Upload, organize, and read PDFs with intelligent analysis and progress tracking.
        </p>
      </Card>
    </div>
  );
};

export default DocumentsPage;
