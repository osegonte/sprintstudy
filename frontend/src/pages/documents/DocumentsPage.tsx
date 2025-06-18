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