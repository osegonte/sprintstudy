import React, { useState, useEffect } from 'react';
import { api } from '../api/client';

export const ConnectionTest = () => {
  const [status, setStatus] = useState('testing');
  const [details, setDetails] = useState('');

  useEffect(() => {
    testConnection();
  }, []);

  const testConnection = async () => {
    try {
      setStatus('testing');
      setDetails('Testing connection...');

      // Test 1: Health check
      const health = await api.healthCheck();
      setDetails(prev => prev + '\n✅ Health check passed');

      // Test 2: CORS test
      try {
        await api.request('GET', '/docs');
        setDetails(prev => prev + '\n✅ CORS configured correctly');
      } catch (error) {
        if (error.message.includes('CORS')) {
          setDetails(prev => prev + '\n❌ CORS configuration issue');
          setStatus('cors_error');
          return;
        }
      }

      setStatus('success');
      setDetails(prev => prev + '\n🎉 All tests passed!');
    } catch (error) {
      setStatus('error');
      setDetails(prev => prev + `\n❌ Error: ${error.message}`);
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'testing': return '#fbbf24';
      case 'success': return '#10b981';
      case 'error': 
      case 'cors_error': return '#ef4444';
      default: return '#6b7280';
    }
  };

  return (
    <div style={{ 
      padding: '20px', 
      border: `2px solid ${getStatusColor()}`, 
      borderRadius: '8px',
      backgroundColor: '#f9fafb',
      fontFamily: 'monospace'
    }}>
      <h3>🔌 Backend Connection Test</h3>
      <div style={{ marginBottom: '10px' }}>
        <strong>Status:</strong> <span style={{ color: getStatusColor() }}>{status}</span>
      </div>
      <div style={{ marginBottom: '10px' }}>
        <strong>API URL:</strong> {api.baseURL}
      </div>
      <pre style={{ 
        backgroundColor: '#1f2937', 
        color: '#f9fafb', 
        padding: '10px', 
        borderRadius: '4px',
        fontSize: '12px',
        overflowX: 'auto'
      }}>
        {details}
      </pre>
      <button 
        onClick={testConnection}
        style={{
          padding: '8px 16px',
          backgroundColor: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        🔄 Test Again
      </button>
    </div>
  );
};