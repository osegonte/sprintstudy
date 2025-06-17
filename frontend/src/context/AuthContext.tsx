import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authAPI, setAuthToken } from '../services/api';
import { User, UserStats, AuthResponse, LoginRequest, SignupRequest } from '../types';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  userStats: UserStats | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  signup: (userData: SignupRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  // Check for existing session on mount
  useEffect(() => {
    const checkExistingSession = async () => {
      const token = localStorage.getItem('cinestudy_token');
      if (token) {
        setAuthToken(token);
        try {
          await refreshUser();
        } catch (error) {
          console.error('Failed to refresh user session:', error);
          localStorage.removeItem('cinestudy_token');
          setAuthToken(null);
        }
      }
      setIsLoading(false);
    };

    checkExistingSession();
  }, []);

  const login = async (credentials: LoginRequest) => {
    try {
      setIsLoading(true);
      const response: AuthResponse = await authAPI.login(credentials);
      setUser(response.user);
      // Stats might be included in auth response or fetched separately
      if ('stats' in response) {
        setUserStats((response as any).stats);
      }
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error.message || 'Login failed');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (userData: SignupRequest) => {
    try {
      setIsLoading(true);
      const response: AuthResponse = await authAPI.signup(userData);
      setUser(response.user);
      if ('stats' in response) {
        setUserStats((response as any).stats);
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      toast.error(error.message || 'Signup failed');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setUserStats(null);
      setAuthToken(null);
    }
  };

  const refreshUser = async () => {
    try {
      const response = await authAPI.getCurrentUser();
      setUser(response.user);
      setUserStats(response.stats);
    } catch (error: any) {
      console.error('Refresh user error:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    userStats,
    isAuthenticated,
    isLoading,
    login,
    signup,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
