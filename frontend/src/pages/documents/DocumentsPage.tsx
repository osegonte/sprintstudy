// src/pages/documents/DocumentsPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { documentsAPI, topicsAPI } from '../../services/api';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card, { CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { 
  FileText, 
  Plus, 
  Grid, 
  List, 
  Search, 
  Filter, 
  Upload, 
  Eye, 
  Edit, 
  Trash2, 
  MoreVertical,
  X,
  ChevronDown,
  Star,
  Calendar,
  Clock,
  BookOpen,
  Download,
  Check,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Document, Topic } from '../../types';
import { formatFileSize, formatRelativeTime, formatDuration, cn } from '../../lib/utils';

// Upload Modal Component
interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (files: FileList, metadata: any) => Promise<void>;
  topics: Topic[];
  isUploading: boolean;
}

const UploadModal: React.FC<UploadModalProps> = ({ 
  isOpen, 
  onClose, 
  onUpload, 
  topics, 
  isUploading 
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    topic_id: '',
    priority: 3,
    notes: ''
  });
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(file => file.type === 'application/pdf');
    if (files.length > 0) {
      setSelectedFiles(files);
      if (files.length === 1) {
        setFormData(prev => ({ ...prev, title: files[0].name.replace('.pdf', '') }));
      }
    } else {
      toast.error('Please select PDF files only');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(files);
    if (files.length === 1) {
      setFormData(prev => ({ ...prev, title: files[0].name.replace('.pdf', '') }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      toast.error('Please select at least one file');
      return;
    }

    try {
      // Create FileList from selected files
      const fileList = selectedFiles.reduce((dt, file) => {
        dt.items.add(file);
        return dt;
      }, new DataTransfer()).files;

      await onUpload(fileList, formData);
      
      // Reset form
      setSelectedFiles([]);
      setFormData({ title: '', topic_id: '', priority: 3, notes: '' });
      setUploadProgress(0);
      onClose();
    } catch (error) {
      console.error('Upload error:', error);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
        
        <div className="relative w-full max-w-2xl bg-white rounded-lg shadow-xl">
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-900">Upload Documents</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Drag & Drop Area */}
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                isDragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                Drop PDF files here or click to browse
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Supported formats: PDF • Max size: 50MB per file
              </p>
              <input
                type="file"
                multiple
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                Browse Files
              </Button>
            </div>

            {/* Selected Files */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium text-gray-900">Selected Files ({selectedFiles.length})</h3>
                <div className="max-h-32 overflow-y-auto space-y-2">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <FileText className="w-5 h-5 text-red-600" />
                        <div>
                          <p className="font-medium text-gray-900 truncate max-w-xs">{file.name}</p>
                          <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload Progress */}
            {isUploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Metadata Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Document Title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter document title"
                required
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Topic
                </label>
                <select
                  value={formData.topic_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, topic_id: e.target.value }))}
                  className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a topic</option>
                  {topics.map(topic => (
                    <option key={topic.id} value={topic.id}>{topic.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority Level
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                  className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={1}>1 - Very Low</option>
                  <option value={2}>2 - Low</option>
                  <option value={3}>3 - Medium</option>
                  <option value={4}>4 - High</option>
                  <option value={5}>5 - Very High</option>
                </select>
              </div>

              <Input
                label="Notes (Optional)"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Add notes about this document"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                isLoading={isUploading}
                disabled={selectedFiles.length === 0}
              >
                Upload {selectedFiles.length > 0 && `(${selectedFiles.length})`}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Document Card Component
interface DocumentCardProps {
  document: Document;
  onEdit: (document: Document) => void;
  onDelete: (document: Document) => void;
  onView: (document: Document) => void;
}

const DocumentCard: React.FC<DocumentCardProps> = ({ 
  document, 
  onEdit, 
  onDelete, 
  onView 
}) => {
  const [showActions, setShowActions] = useState(false);
  const progress = document.completion_percentage || 0;

  const getDifficultyStars = (level: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={cn(
          "w-3 h-3",
          i < level ? "text-yellow-400 fill-current" : "text-gray-300"
        )}
      />
    ));
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-200 relative">
      <CardContent className="p-6">
        {/* Actions Menu */}
        <div className="absolute top-4 right-4">
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowActions(!showActions)}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
            
            {showActions && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                <button
                  onClick={() => { onView(document); setShowActions(false); }}
                  className="flex items-center space-x-2 w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  <span>View</span>
                </button>
                <button
                  onClick={() => { onEdit(document); setShowActions(false); }}
                  className="flex items-center space-x-2 w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => { onDelete(document); setShowActions(false); }}
                  className="flex items-center space-x-2 w-full px-4 py-2 text-left hover:bg-gray-50 text-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Document Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-20 bg-red-100 rounded-lg flex items-center justify-center">
            <FileText className="w-10 h-10 text-red-600" />
          </div>
        </div>

        {/* Document Title */}
        <h3 className="font-semibold text-gray-900 text-center mb-2 truncate" title={document.title}>
          {document.title}
        </h3>

        {/* Topic Badge */}
        {document.topic && (
          <div className="flex justify-center mb-3">
            <span
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
              style={{ backgroundColor: document.topic.color }}
            >
              {document.topic.name}
            </span>
          </div>
        )}

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Progress</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>

        {/* Metadata */}
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center justify-between">
            <span>Pages</span>
            <span>{document.total_pages}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Difficulty</span>
            <div className="flex space-x-0.5">
              {getDifficultyStars(document.difficulty_level)}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span>Last Read</span>
            <span>{document.updated_at ? formatRelativeTime(document.updated_at) : 'Never'}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Main Documents Page Component
const DocumentsPage: React.FC = () => {
  const { user } = useAuth();
  const { state, dispatch } = useApp();
  
  // State management
  const [documents, setDocuments] = useState<Document[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState('updated_at');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [documentsResponse, topicsResponse] = await Promise.all([
        documentsAPI.getAll(),
        topicsAPI.getAll()
      ]);

      setDocuments(documentsResponse.documents);
      setTopics(topicsResponse.topics);
      dispatch({ type: 'SET_DOCUMENTS', payload: documentsResponse.documents });
      dispatch({ type: 'SET_TOPICS', payload: topicsResponse.topics });
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter and sort documents
  const filteredAndSortedDocuments = React.useMemo(() => {
    let filtered = documents;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(doc =>
        doc.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Topic filter
    if (selectedTopic) {
      filtered = filtered.filter(doc => doc.topic_id === selectedTopic);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'updated_at':
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        case 'total_pages':
          return b.total_pages - a.total_pages;
        case 'completion_percentage':
          return (b.completion_percentage || 0) - (a.completion_percentage || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [documents, searchQuery, selectedTopic, sortBy]);

  // Upload handler with proper error handling
  const handleUpload = async (files: FileList, metadata: any) => {
    setIsUploading(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const uploadMetadata = {
          title: metadata.title || file.name.replace('.pdf', ''),
          topic_id: metadata.topic_id || '',
          priority: metadata.priority || 3,
          notes: metadata.notes || ''
        };
        
        return documentsAPI.upload(file, uploadMetadata);
      });

      const results = await Promise.all(uploadPromises);
      toast.success(`${files.length} document(s) uploaded successfully!`);
      await loadData(); // Refresh the document list
      
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Upload failed');
      throw error; // Re-throw to let the modal handle it
    } finally {
      setIsUploading(false);
    }
  };

  // Document actions
  const handleView = (document: Document) => {
    toast.info('Document viewer coming soon!');
  };

  const handleEdit = (document: Document) => {
    toast.info('Document editing coming soon!');
  };

  const handleDelete = async (document: Document) => {
    if (window.confirm(`Are you sure you want to delete "${document.title}"?`)) {
      try {
        await documentsAPI.delete(document.id);
        toast.success('Document deleted successfully');
        await loadData(); // Refresh the document list
      } catch (error) {
        console.error('Delete error:', error);
        toast.error('Failed to delete document');
      }
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedTopic('');
    setSortBy('updated_at');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" text="Loading documents..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <FileText className="w-6 h-6 text-blue-600" />
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Documents</h1>
                  <p className="text-xs text-gray-500">Manage your study materials</p>
                </div>
              </div>
            </div>
            
            <Button
              onClick={() => setIsUploadModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Upload PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            {/* Search and Filters */}
            <div className="flex flex-1 items-center space-x-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                leftIcon={<Filter className="w-4 h-4" />}
              >
                Filters
              </Button>
            </div>

            {/* View Controls */}
            <div className="flex items-center space-x-4">
              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="updated_at">Last Modified</option>
                <option value="title">Name</option>
                <option value="total_pages">Pages</option>
                <option value="completion_percentage">Progress</option>
              </select>

              {/* View Toggle */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <Button
                  variant={viewMode === 'grid' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700">Topic:</label>
                  <select
                    value={selectedTopic}
                    onChange={(e) => setSelectedTopic(e.target.value)}
                    className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Topics</option>
                    {topics.map(topic => (
                      <option key={topic.id} value={topic.id}>{topic.name}</option>
                    ))}
                  </select>
                </div>

                {(searchQuery || selectedTopic) && (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {filteredAndSortedDocuments.length > 0 ? (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredAndSortedDocuments.map(document => (
                <DocumentCard
                  key={document.id}
                  document={document}
                  onView={handleView}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Name</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Topic</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Progress</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Pages</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Last Read</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSortedDocuments.map(document => (
                      <tr key={document.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-3">
                            <FileText className="w-5 h-5 text-red-600" />
                            <span className="font-medium text-gray-900">{document.title}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {document.topic ? (
                            <span
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                              style={{ backgroundColor: document.topic.color }}
                            >
                              {document.topic.name}
                            </span>
                          ) : (
                            <span className="text-gray-500">Uncategorized</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-green-500 h-2 rounded-full"
                                style={{ width: `${Math.min(document.completion_percentage || 0, 100)}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-600">
                              {document.completion_percentage || 0}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-gray-900">{document.total_pages}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-gray-600">
                            {document.updated_at ? formatRelativeTime(document.updated_at) : 'Never'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleView(document)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(document)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(document)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )
        ) : (
          /* Empty State */
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <FileText className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {searchQuery || selectedTopic ? 'No documents found' : 'No documents yet'}
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              {searchQuery || selectedTopic 
                ? 'Try adjusting your search or filters to find what you\'re looking for.'
                : 'Upload your first PDF to start tracking your reading progress and organize your study materials.'
              }
            </p>
            {searchQuery || selectedTopic ? (
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            ) : (
              <div className="space-y-4">
                <Button
                  onClick={() => setIsUploadModalOpen(true)}
                  leftIcon={<Plus className="w-4 h-4" />}
                  size="lg"
                >
                  Upload Your First Document
                </Button>
                <p className="text-sm text-gray-500">
                  Supported formats: PDF • Max size: 50MB per file
                </p>
              </div>
            )}
          </div>
        )}

        {/* Results Summary */}
        {(searchQuery || selectedTopic) && filteredAndSortedDocuments.length > 0 && (
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Showing {filteredAndSortedDocuments.length} of {documents.length} documents
              {searchQuery && ` matching "${searchQuery}"`}
              {selectedTopic && ` in ${topics.find(t => t.id === selectedTopic)?.name}`}
            </p>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUpload={handleUpload}
        topics={topics}
        isUploading={isUploading}
      />
    </div>
  );
};

export default DocumentsPage;