// src/pages/topics/TopicsPage.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { topicsAPI } from '../../services/api';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card, { CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { 
  BookOpen, 
  Plus, 
  Grid, 
  List, 
  Search, 
  Edit, 
  Trash2, 
  MoreVertical,
  X,
  Check,
  Calendar,
  Target,
  FileText,
  Clock,
  TrendingUp,
  Star,
  Archive,
  Palette
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Topic } from '../../types';
import { formatRelativeTime, cn } from '../../lib/utils';

// Color palette for topics
const TOPIC_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#F97316', // Orange
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#EC4899', // Pink
  '#6366F1', // Indigo
  '#14B8A6', // Teal
  '#F472B6', // Rose
];

// Icon options for topics
const TOPIC_ICONS = [
  'BookOpen', 'FileText', 'Target', 'Star', 'TrendingUp', 
  'Calendar', 'Clock', 'Archive', 'Grid', 'List'
];

// Create/Edit Topic Modal
interface TopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  topic?: Topic | null;
  onSave: (topicData: Partial<Topic>) => Promise<void>;
  isLoading: boolean;
}

const TopicModal: React.FC<TopicModalProps> = ({
  isOpen,
  onClose,
  topic,
  onSave,
  isLoading
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: TOPIC_COLORS[0],
    icon: 'BookOpen',
    priority: 3,
    target_completion_date: ''
  });
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  // Reset form when modal opens/closes or topic changes
  useEffect(() => {
    if (isOpen) {
      if (topic) {
        setFormData({
          name: topic.name || '',
          description: topic.description || '',
          color: topic.color || TOPIC_COLORS[0],
          icon: topic.icon || 'BookOpen',
          priority: topic.priority || 3,
          target_completion_date: topic.target_completion_date 
            ? new Date(topic.target_completion_date).toISOString().split('T')[0] 
            : ''
        });
      } else {
        setFormData({
          name: '',
          description: '',
          color: TOPIC_COLORS[0],
          icon: 'BookOpen',
          priority: 3,
          target_completion_date: ''
        });
      }
      setErrors({});
    }
  }, [isOpen, topic]);

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Topic name is required';
    } else if (formData.name.length < 2) {
      newErrors.name = 'Topic name must be at least 2 characters';
    }

    if (formData.target_completion_date) {
      const targetDate = new Date(formData.target_completion_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (targetDate < today) {
        newErrors.target_completion_date = 'Target date cannot be in the past';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      const submitData = {
        ...formData,
        target_completion_date: formData.target_completion_date || null
      };
      
      await onSave(submitData);
      onClose();
    } catch (error) {
      console.error('Error saving topic:', error);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
        
        <div className="relative w-full max-w-lg bg-white rounded-lg shadow-xl">
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-900">
              {topic ? 'Edit Topic' : 'Create New Topic'}
            </h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Topic Name */}
            <Input
              label="Topic Name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              error={errors.name}
              placeholder="e.g., Mathematics, History, Biology"
              required
            />

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (Optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Brief description of this topic..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Color Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Color Theme
              </label>
              <div className="grid grid-cols-6 gap-2">
                {TOPIC_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => handleInputChange('color', color)}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-all",
                      formData.color === color 
                        ? "border-gray-400 scale-110" 
                        : "border-gray-200 hover:scale-105"
                    )}
                    style={{ backgroundColor: color }}
                  >
                    {formData.color === color && (
                      <Check className="w-4 h-4 text-white mx-auto" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority Level
              </label>
              <select
                value={formData.priority}
                onChange={(e) => handleInputChange('priority', parseInt(e.target.value))}
                className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={1}>1 - Very Low</option>
                <option value={2}>2 - Low</option>
                <option value={3}>3 - Medium</option>
                <option value={4}>4 - High</option>
                <option value={5}>5 - Very High</option>
              </select>
            </div>

            {/* Target Completion Date */}
            <Input
              label="Target Completion Date (Optional)"
              type="date"
              value={formData.target_completion_date}
              onChange={(e) => handleInputChange('target_completion_date', e.target.value)}
              error={errors.target_completion_date}
            />

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                isLoading={isLoading}
              >
                {topic ? 'Update Topic' : 'Create Topic'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Topic Card Component
interface TopicCardProps {
  topic: Topic;
  onEdit: (topic: Topic) => void;
  onDelete: (topic: Topic) => void;
  onArchive: (topic: Topic) => void;
}

const TopicCard: React.FC<TopicCardProps> = ({
  topic,
  onEdit,
  onDelete,
  onArchive
}) => {
  const [showActions, setShowActions] = useState(false);
  const progress = topic.completion_percentage || 0;

  const getDaysUntilTarget = () => {
    if (!topic.target_completion_date) return null;
    
    const targetDate = new Date(topic.target_completion_date);
    const today = new Date();
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  const daysUntilTarget = getDaysUntilTarget();

  return (
    <Card className="group hover:shadow-lg transition-all duration-200 relative overflow-hidden">
      {/* Color accent bar */}
      <div 
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: topic.color }}
      />
      
      <CardContent className="p-6 pt-8">
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
                  onClick={() => { onEdit(topic); setShowActions(false); }}
                  className="flex items-center space-x-2 w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => { onArchive(topic); setShowActions(false); }}
                  className="flex items-center space-x-2 w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors"
                >
                  <Archive className="w-4 h-4" />
                  <span>{topic.is_archived ? 'Unarchive' : 'Archive'}</span>
                </button>
                <button
                  onClick={() => { onDelete(topic); setShowActions(false); }}
                  className="flex items-center space-x-2 w-full px-4 py-2 text-left hover:bg-gray-50 text-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Topic Header */}
        <div className="flex items-start space-x-3 mb-4">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
            style={{ backgroundColor: topic.color }}
          >
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate" title={topic.name}>
              {topic.name}
            </h3>
            {topic.description && (
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                {topic.description}
              </p>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Progress</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all duration-300"
              style={{ 
                width: `${Math.min(progress, 100)}%`,
                backgroundColor: topic.color 
              }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">
              {topic.total_documents || 0}
            </div>
            <div className="text-xs text-gray-500">Documents</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">
              {topic.total_pages || 0}
            </div>
            <div className="text-xs text-gray-500">Pages</div>
          </div>
        </div>

        {/* Target Date & Priority */}
        <div className="space-y-2 text-sm">
          {daysUntilTarget !== null && (
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Target Date</span>
              <span className={cn(
                "font-medium",
                daysUntilTarget < 0 ? "text-red-600" :
                daysUntilTarget < 7 ? "text-orange-600" :
                "text-gray-900"
              )}>
                {daysUntilTarget < 0 
                  ? `${Math.abs(daysUntilTarget)} days overdue`
                  : daysUntilTarget === 0 
                  ? 'Due today'
                  : `${daysUntilTarget} days left`
                }
              </span>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Priority</span>
            <div className="flex space-x-0.5">
              {Array.from({ length: 5 }, (_, i) => (
                <Star
                  key={i}
                  className={cn(
                    "w-3 h-3",
                    i < topic.priority 
                      ? "text-yellow-400 fill-current" 
                      : "text-gray-300"
                  )}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-600">Last Updated</span>
            <span className="text-gray-900">
              {formatRelativeTime(topic.updated_at)}
            </span>
          </div>
        </div>

        {/* Archived Badge */}
        {topic.is_archived && (
          <div className="mt-3 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            <Archive className="w-3 h-3 mr-1" />
            Archived
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Main Topics Page Component
const TopicsPage: React.FC = () => {
  const { user } = useAuth();
  const { state, dispatch } = useApp();
  
  // State management
  const [topics, setTopics] = useState<Topic[]>([]);
  const [filteredTopics, setFilteredTopics] = useState<Topic[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [sortBy, setSortBy] = useState('updated_at');
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load topics
  useEffect(() => {
    loadTopics();
  }, []);

  // Filter topics based on search and archive status
  useEffect(() => {
    let filtered = topics.filter(topic => {
      const matchesSearch = !searchQuery || 
        topic.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        topic.description?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesArchived = showArchived || !topic.is_archived;
      
      return matchesSearch && matchesArchived;
    });

    // Sort topics
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'updated_at':
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        case 'priority':
          return b.priority - a.priority;
        case 'completion_percentage':
          return (b.completion_percentage || 0) - (a.completion_percentage || 0);
        default:
          return 0;
      }
    });

    setFilteredTopics(filtered);
  }, [topics, searchQuery, showArchived, sortBy]);

  const loadTopics = async () => {
    try {
      setIsLoading(true);
      const response = await topicsAPI.getAll();
      setTopics(response.topics);
      dispatch({ type: 'SET_TOPICS', payload: response.topics });
    } catch (error) {
      console.error('Failed to load topics:', error);
      toast.error('Failed to load topics');
    } finally {
      setIsLoading(false);
    }
  };

  // Topic CRUD operations
  const handleCreateTopic = () => {
    setEditingTopic(null);
    setIsTopicModalOpen(true);
  };

  const handleEditTopic = (topic: Topic) => {
    setEditingTopic(topic);
    setIsTopicModalOpen(true);
  };

  const handleSaveTopic = async (topicData: Partial<Topic>) => {
    try {
      setIsSubmitting(true);
      
      if (editingTopic) {
        await topicsAPI.update(editingTopic.id, topicData);
        toast.success('Topic updated successfully!');
      } else {
        await topicsAPI.create(topicData);
        toast.success('Topic created successfully!');
      }
      
      await loadTopics();
      setIsTopicModalOpen(false);
      setEditingTopic(null);
    } catch (error: any) {
      console.error('Error saving topic:', error);
      toast.error(error.message || 'Failed to save topic');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTopic = async (topic: Topic) => {
    if (window.confirm(`Are you sure you want to delete "${topic.name}"? This action cannot be undone.`)) {
      try {
        await topicsAPI.delete(topic.id);
        toast.success('Topic deleted successfully!');
        await loadTopics();
      } catch (error: any) {
        console.error('Error deleting topic:', error);
        toast.error(error.message || 'Failed to delete topic');
      }
    }
  };

  const handleArchiveTopic = async (topic: Topic) => {
    try {
      await topicsAPI.update(topic.id, { is_archived: !topic.is_archived });
      toast.success(`Topic ${topic.is_archived ? 'unarchived' : 'archived'} successfully!`);
      await loadTopics();
    } catch (error: any) {
      console.error('Error archiving topic:', error);
      toast.error(error.message || 'Failed to update topic');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" text="Loading topics..." />
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
                <BookOpen className="w-6 h-6 text-blue-600" />
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Topics</h1>
                  <p className="text-xs text-gray-500">Organize your study materials</p>
                </div>
              </div>
            </div>
            
            <Button
              onClick={handleCreateTopic}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Create Topic
            </Button>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            {/* Search */}
            <div className="flex flex-1 items-center space-x-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search topics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {/* Show Archived Toggle */}
              <label className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700">Show archived</span>
              </label>
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
                <option value="name">Name</option>
                <option value="priority">Priority</option>
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
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {filteredTopics.length > 0 ? (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredTopics.map(topic => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  onEdit={handleEditTopic}
                  onDelete={handleDeleteTopic}
                  onArchive={handleArchiveTopic}
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
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Progress</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Documents</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Priority</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Target Date</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTopics.map(topic => (
                      <tr key={topic.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-3">
                            <div 
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: topic.color }}
                            />
                            <div>
                              <span className="font-medium text-gray-900">{topic.name}</span>
                              {topic.description && (
                                <p className="text-sm text-gray-600 truncate max-w-xs">
                                  {topic.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div
                                className="h-2 rounded-full"
                                style={{ 
                                  width: `${Math.min(topic.completion_percentage || 0, 100)}%`,
                                  backgroundColor: topic.color 
                                }}
                              />
                            </div>
                            <span className="text-sm text-gray-600">
                              {topic.completion_percentage || 0}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-gray-900">{topic.total_documents || 0}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex space-x-0.5">
                            {Array.from({ length: 5 }, (_, i) => (
                              <Star
                                key={i}
                                className={cn(
                                  "w-3 h-3",
                                  i < topic.priority 
                                    ? "text-yellow-400 fill-current" 
                                    : "text-gray-300"
                                )}
                              />
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-gray-600">
                            {topic.target_completion_date 
                              ? new Date(topic.target_completion_date).toLocaleDateString()
                              : 'No target'
                            }
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {topic.is_archived ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                              <Archive className="w-3 h-3 mr-1" />
                              Archived
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-600">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditTopic(topic)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleArchiveTopic(topic)}
                            >
                              <Archive className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteTopic(topic)}
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
              <BookOpen className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {searchQuery ? 'No topics found' : 'No topics yet'}
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              {searchQuery 
                ? 'Try adjusting your search to find what you\'re looking for.'
                : 'Create your first topic to organize your study materials and track your progress across different subjects.'
              }
            </p>
            {searchQuery ? (
              <Button variant="outline" onClick={() => setSearchQuery('')}>
                Clear Search
              </Button>
            ) : (
              <div className="space-y-4">
                <Button
                  onClick={handleCreateTopic}
                  leftIcon={<Plus className="w-4 h-4" />}
                  size="lg"
                >
                  Create Your First Topic
                </Button>
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  {['Mathematics', 'History', 'Biology', 'Programming'].map((suggestion) => (
                    <Button
                      key={suggestion}
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingTopic(null);
                        setIsTopicModalOpen(true);
                        // You could pre-fill the name with the suggestion
                      }}
                      className="text-xs"
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Results Summary */}
        {(searchQuery || showArchived) && filteredTopics.length > 0 && (
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Showing {filteredTopics.length} of {topics.length} topics
              {searchQuery && ` matching "${searchQuery}"`}
              {showArchived && ' (including archived)'}
            </p>
          </div>
        )}

        {/* Quick Stats */}
        {topics.length > 0 && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {topics.filter(t => !t.is_archived).length}
                </div>
                <div className="text-sm text-gray-600">Active Topics</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {topics.reduce((sum, t) => sum + (t.total_documents || 0), 0)}
                </div>
                <div className="text-sm text-gray-600">Total Documents</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {Math.round(topics.reduce((sum, t) => sum + (t.completion_percentage || 0), 0) / topics.length) || 0}%
                </div>
                <div className="text-sm text-gray-600">Average Progress</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {topics.filter(t => t.target_completion_date && new Date(t.target_completion_date) < new Date()).length}
                </div>
                <div className="text-sm text-gray-600">Overdue Topics</div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Topic Modal */}
      <TopicModal
        isOpen={isTopicModalOpen}
        onClose={() => {
          setIsTopicModalOpen(false);
          setEditingTopic(null);
        }}
        topic={editingTopic}
        onSave={handleSaveTopic}
        isLoading={isSubmitting}
      />
    </div>
  );
};

export default TopicsPage;