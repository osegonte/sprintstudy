import { useState, useEffect } from 'react';
import { api } from '../client';

export const useDocuments = (filters = {}) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.getDocuments(filters);
      setDocuments(response.documents || []);
    } catch (error) {
      setError(error.message);
      console.error('Failed to fetch documents:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [JSON.stringify(filters)]);

  const uploadDocument = async (file, metadata = {}) => {
    try {
      setError(null);
      const response = await api.uploadDocument(file, {
        ...metadata,
        onProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          console.log(`Upload progress: ${percent}%`);
        }
      });
      
      // Refresh the documents list
      await fetchDocuments();
      
      return response;
    } catch (error) {
      setError(error.message);
      throw error;
    }
  };

  const deleteDocument = async (documentId) => {
    try {
      setError(null);
      await api.deleteDocument(documentId);
      
      // Remove from local state
      setDocuments(docs => docs.filter(doc => doc.id !== documentId));
    } catch (error) {
      setError(error.message);
      throw error;
    }
  };

  return {
    documents,
    loading,
    error,
    uploadDocument,
    deleteDocument,
    refetch: fetchDocuments
  };
};
