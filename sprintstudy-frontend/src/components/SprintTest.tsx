import React, { useState } from 'react';
import { api } from '../services/api';
import { Play, Pause, Target } from 'lucide-react';
import toast from 'react-hot-toast';

export const SprintTest: React.FC = () => {
  const [selectedDocument, setSelectedDocument] = useState('');
  const [sprintSuggestion, setSprintSuggestion] = useState<any>(null);
  const [currentSprint, setCurrentSprint] = useState<any>(null);
  const [pageTime, setPageTime] = useState(120);
  const [speedFeedback, setSpeedFeedback] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const generateSprint = async () => {
    if (!selectedDocument) {
      toast.error('Please select a document first');
      return;
    }

    setLoading(true);
    const result = await api.generateSprint(selectedDocument);
    if (result.success) {
      setSprintSuggestion(result.data.sprint_suggestion);
      toast.success('Sprint suggestion generated!');
    } else {
      toast.error(result.error || 'Failed to generate sprint');
    }
    setLoading(false);
  };

  const getSpeedFeedback = async () => {
    if (!selectedDocument) {
      toast.error('Please select a document first');
      return;
    }

    setLoading(true);
    const result = await api.getSpeedFeedback(pageTime, selectedDocument);
    if (result.success) {
      setSpeedFeedback(result.data.feedback);
      toast.success('Speed feedback received!');
    } else {
      toast.error(result.error || 'Failed to get feedback');
    }
    setLoading(false);
  };

  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4">🎯 Sprint Testing</h2>
      
      {/* Document Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Document ID (for testing)
        </label>
        <input
          type="text"
          value={selectedDocument}
          onChange={(e) => setSelectedDocument(e.target.value)}
          placeholder="Enter document ID from your documents list"
          className="input"
        />
      </div>

      {/* Sprint Generation */}
      <div className="mb-6">
        <button
          onClick={generateSprint}
          disabled={loading || !selectedDocument}
          className="btn-primary mr-4"
        >
          {loading ? 'Generating...' : 'Generate Sprint'}
        </button>
        
        {sprintSuggestion && (
          <div className="mt-4 p-4 bg-blue-50 rounded-xl">
            <h3 className="font-semibold mb-2">📚 Sprint Suggestion</h3>
            <p>Pages: {sprintSuggestion.start_page} - {sprintSuggestion.end_page}</p>
            <p>Estimated time: {Math.round(sprintSuggestion.estimated_time_seconds / 60)} minutes</p>
            <p>Total pages: {sprintSuggestion.total_pages}</p>
            <p>Completed: {sprintSuggestion.completed_pages}</p>
            <p>Remaining: {sprintSuggestion.remaining_pages}</p>
          </div>
        )}
      </div>

      {/* Speed Feedback Test */}
      <div className="mb-6">
        <div className="flex items-center space-x-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Page Time (seconds)
            </label>
            <input
              type="number"
              value={pageTime}
              onChange={(e) => setPageTime(Number(e.target.value))}
              className="input w-32"
              min="1"
            />
          </div>
          <button
            onClick={getSpeedFeedback}
            disabled={loading || !selectedDocument}
            className="btn-primary mt-6"
          >
            Get Speed Feedback
          </button>
        </div>

        {speedFeedback && (
          <div className="p-4 bg-green-50 rounded-xl">
            <h3 className="font-semibold mb-2">⚡ Speed Feedback</h3>
            <div className="flex items-center space-x-2">
              <span className="text-2xl">{speedFeedback.emoji}</span>
              <span className={`font-medium text-${speedFeedback.color}-600`}>
                {speedFeedback.message}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1">Type: {speedFeedback.type}</p>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-gray-50 rounded-xl p-4">
        <h3 className="font-semibold mb-2">📝 Testing Instructions</h3>
        <ol className="text-sm text-gray-700 space-y-1">
          <li>1. First upload a PDF document in the dashboard</li>
          <li>2. Copy the document ID from the documents list</li>
          <li>3. Paste it in the Document ID field above</li>
          <li>4. Test sprint generation and speed feedback</li>
          <li>5. Try different page times to see different feedback messages</li>
        </ol>
      </div>
    </div>
  );
};
