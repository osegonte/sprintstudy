// src/pages/NotFoundPage.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import { Home, ArrowLeft } from 'lucide-react';

const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* 404 Illustration */}
        <div className="mb-8">
          <div className="text-9xl font-bold text-gray-300 mb-4">404</div>
          <div className="w-32 h-32 mx-auto mb-6 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
            <div className="text-4xl">📚</div>
          </div>
        </div>

        {/* Content */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Page Not Found
          </h1>
          <p className="text-gray-600 mb-6">
            Sorry, the page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            as={Link}
            to="/dashboard"
            variant="primary"
            className="w-full"
            leftIcon={<Home className="w-4 h-4" />}
          >
            Go to Dashboard
          </Button>
          
          <Button
            onClick={() => window.history.back()}
            variant="outline"
            className="w-full"
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Go Back
          </Button>
        </div>

        {/* Help */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Need help? Contact support or visit our{' '}
            <Link to="/help" className="text-blue-600 hover:text-blue-500">
              help center
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;