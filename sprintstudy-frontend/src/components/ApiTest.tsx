import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

interface TestResult {
  name: string;
  status: 'pending' | 'success' | 'error';
  message: string;
}

export const ApiTest: React.FC = () => {
  const [tests, setTests] = useState<TestResult[]>([
    { name: 'Health Check', status: 'pending', message: '' },
    { name: 'Authentication (if logged in)', status: 'pending', message: '' },
    { name: 'Dashboard Data', status: 'pending', message: '' },
    { name: 'Documents List', status: 'pending', message: '' },
  ]);

  useEffect(() => {
    runTests();
  }, []);

  const updateTest = (index: number, status: 'success' | 'error', message: string) => {
    setTests(prev => prev.map((test, i) => 
      i === index ? { ...test, status, message } : test
    ));
  };

  const runTests = async () => {
    // Test 1: Health Check
    try {
      const healthResult = await api.healthCheck();
      if (healthResult.success) {
        updateTest(0, 'success', `API v${healthResult.data.version} - Features: ${healthResult.data.features.join(', ')}`);
      } else {
        updateTest(0, 'error', healthResult.error || 'Health check failed');
      }
    } catch (error) {
      updateTest(0, 'error', 'Network error');
    }

    // Test 2: Authentication (if token exists)
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const dashResult = await api.getDashboardData();
        if (dashResult.success) {
          updateTest(1, 'success', 'Authentication working');
        } else {
          updateTest(1, 'error', 'Authentication failed');
        }
      } catch (error) {
        updateTest(1, 'error', 'Auth test failed');
      }
    } else {
      updateTest(1, 'error', 'No token found - please login');
    }

    // Test 3: Dashboard Data (if authenticated)
    if (token) {
      try {
        const dashResult = await api.getDashboardData();
        if (dashResult.success) {
          updateTest(2, 'success', `Found ${dashResult.data.stats.total_documents} documents, ${dashResult.data.stats.study_streak_days} day streak`);
        } else {
          updateTest(2, 'error', dashResult.error || 'Dashboard data failed');
        }
      } catch (error) {
        updateTest(2, 'error', 'Dashboard test failed');
      }
    } else {
      updateTest(2, 'error', 'Authentication required');
    }

    // Test 4: Documents List (if authenticated)
    if (token) {
      try {
        const docsResult = await api.getDocuments();
        if (docsResult.success) {
          updateTest(3, 'success', `Found ${docsResult.data.documents?.length || 0} documents`);
        } else {
          updateTest(3, 'error', docsResult.error || 'Documents list failed');
        }
      } catch (error) {
        updateTest(3, 'error', 'Documents test failed');
      }
    } else {
      updateTest(3, 'error', 'Authentication required');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="text-green-500" size={20} />;
      case 'error':
        return <XCircle className="text-red-500" size={20} />;
      default:
        return <Clock className="text-yellow-500 animate-spin" size={20} />;
    }
  };

  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4">🧪 API Test Results</h2>
      <div className="space-y-3">
        {tests.map((test, index) => (
          <div key={index} className="flex items-start space-x-3 p-3 border rounded-lg">
            {getStatusIcon(test.status)}
            <div className="flex-1">
              <h3 className="font-semibold">{test.name}</h3>
              <p className={`text-sm ${test.status === 'error' ? 'text-red-600' : 'text-gray-600'}`}>
                {test.message || 'Testing...'}
              </p>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={runTests}
        className="btn-primary mt-4"
      >
        Run Tests Again
      </button>
    </div>
  );
};
