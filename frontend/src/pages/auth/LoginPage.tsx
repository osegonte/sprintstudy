// src/pages/auth/LoginPage.tsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { testConnection } from '../../services/api';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card, { CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { Mail, Lock, BookOpen, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const LoginPage: React.FC = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'failed'>('checking');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/dashboard';

  // Check backend connection on mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        await testConnection();
        setConnectionStatus('connected');
      } catch (error) {
        setConnectionStatus('failed');
        toast.error('Cannot connect to backend. Please ensure the server is running.');
      }
    };

    checkConnection();
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    if (connectionStatus !== 'connected') {
      toast.error('Cannot connect to server. Please try again.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      await login(formData);
      toast.success('Login successful!');
      navigate(from, { replace: true });
    } catch (error: any) {
      toast.error(error.message || 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestLogin = async () => {
    setFormData({
      email: 'test@example.com',
      password: 'password123',
    });
    setErrors({});
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Signing you in..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">CineStudy</h1>
          <p className="text-gray-600">Sign in to your account</p>
        </div>

        {/* Connection Status */}
        {connectionStatus === 'checking' && (
          <Card className="mb-4 border-yellow-200 bg-yellow-50">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <LoadingSpinner size="sm" />
                <span className="text-yellow-800">Connecting to server...</span>
              </div>
            </CardContent>
          </Card>
        )}

        {connectionStatus === 'failed' && (
          <Card className="mb-4 border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <span className="text-red-800">Server connection failed</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Login Form */}
        <Card>
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                name="email"
                type="email"
                label="Email"
                value={formData.email}
                onChange={handleInputChange}
                error={errors.email}
                leftIcon={<Mail className="w-4 h-4" />}
                placeholder="Enter your email"
                autoComplete="email"
              />

              <Input
                name="password"
                type="password"
                label="Password"
                value={formData.password}
                onChange={handleInputChange}
                error={errors.password}
                leftIcon={<Lock className="w-4 h-4" />}
                placeholder="Enter your password"
                autoComplete="current-password"
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                isLoading={isSubmitting}
                disabled={connectionStatus !== 'connected'}
              >
                Sign In
              </Button>
            </form>

            {/* Test Login Button */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleTestLogin}
                disabled={connectionStatus !== 'connected'}
              >
                Use Test Credentials
              </Button>
              <p className="text-xs text-gray-500 text-center mt-2">
                test@example.com / password123
              </p>
            </div>

            {/* Sign Up Link */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Don't have an account?{' '}
                <Link
                  to="/signup"
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  Sign up
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            Secure study management platform
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;