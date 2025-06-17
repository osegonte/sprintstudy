import React, { createContext, useContext, useReducer, ReactNode, useEffect } from 'react';
import { Topic, Document, Achievement, DashboardData } from '../types';

interface AppState {
  topics: Topic[];
  documents: Document[];
  achievements: Achievement[];
  dashboardData: DashboardData | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

type AppAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_TOPICS'; payload: Topic[] }
  | { type: 'ADD_TOPIC'; payload: Topic }
  | { type: 'UPDATE_TOPIC'; payload: { id: string; updates: Partial<Topic> } }
  | { type: 'DELETE_TOPIC'; payload: string }
  | { type: 'SET_DOCUMENTS'; payload: Document[] }
  | { type: 'ADD_DOCUMENT'; payload: Document }
  | { type: 'UPDATE_DOCUMENT'; payload: { id: string; updates: Partial<Document> } }
  | { type: 'DELETE_DOCUMENT'; payload: string }
  | { type: 'SET_ACHIEVEMENTS'; payload: Achievement[] }
  | { type: 'SET_DASHBOARD_DATA'; payload: DashboardData }
  | { type: 'RESET_STATE' };

const initialState: AppState = {
  topics: [],
  documents: [],
  achievements: [],
  dashboardData: null,
  isLoading: false,
  error: null,
  lastUpdated: null,
};

const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    
    case 'SET_TOPICS':
      return { 
        ...state, 
        topics: action.payload, 
        isLoading: false, 
        error: null,
        lastUpdated: new Date()
      };
    
    case 'ADD_TOPIC':
      return { 
        ...state, 
        topics: [...state.topics, action.payload],
        lastUpdated: new Date()
      };
    
    case 'UPDATE_TOPIC':
      return {
        ...state,
        topics: state.topics.map(topic =>
          topic.id === action.payload.id
            ? { ...topic, ...action.payload.updates }
            : topic
        ),
        lastUpdated: new Date()
      };
    
    case 'DELETE_TOPIC':
      return {
        ...state,
        topics: state.topics.filter(topic => topic.id !== action.payload),
        lastUpdated: new Date()
      };
    
    case 'SET_DOCUMENTS':
      return { 
        ...state, 
        documents: action.payload, 
        isLoading: false, 
        error: null,
        lastUpdated: new Date()
      };
    
    case 'ADD_DOCUMENT':
      return { 
        ...state, 
        documents: [...state.documents, action.payload],
        lastUpdated: new Date()
      };
    
    case 'UPDATE_DOCUMENT':
      return {
        ...state,
        documents: state.documents.map(doc =>
          doc.id === action.payload.id
            ? { ...doc, ...action.payload.updates }
            : doc
        ),
        lastUpdated: new Date()
      };
    
    case 'DELETE_DOCUMENT':
      return {
        ...state,
        documents: state.documents.filter(doc => doc.id !== action.payload),
        lastUpdated: new Date()
      };
    
    case 'SET_ACHIEVEMENTS':
      return { 
        ...state, 
        achievements: action.payload, 
        isLoading: false, 
        error: null,
        lastUpdated: new Date()
      };
    
    case 'SET_DASHBOARD_DATA':
      return { 
        ...state, 
        dashboardData: action.payload, 
        isLoading: false, 
        error: null,
        lastUpdated: new Date()
      };
    
    case 'RESET_STATE':
      return initialState;
    
    default:
      return state;
  }
};

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  // Helper functions for common operations
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Helper functions
  const setLoading = (loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  };

  const setError = (error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  };

  const clearError = () => {
    dispatch({ type: 'SET_ERROR', payload: null });
  };

  // Auto-clear errors after 5 seconds
  useEffect(() => {
    if (state.error) {
      const timer = setTimeout(() => {
        clearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [state.error]);

  const value: AppContextType = {
    state,
    dispatch,
    setLoading,
    setError,
    clearError,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};
