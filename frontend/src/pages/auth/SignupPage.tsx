// src/pages/auth/SignupPage.tsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { testConnection } from '../../services/api';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card, { CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { Mail, Lock, User, BookOpen, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const SignupPage: React.FC = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
    full_name: '',
  });
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'failed'>('checking');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { signup, isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();

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
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

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

    if (!formData.username) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.full_name) {
      newErrors.full_name = 'Full name is required';
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
      await signup({
        email: formData.email,
        password: formData.password,
        username: formData.username,
        full_name: formData.full_name,
      });
      toast.success('Account created successfully!');
      navigate('/dashboard', { replace: true });
    } catch (error: any) {
      toast.error(error.message || 'Signup failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Creating your account..." />
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
          <p className="text-gray-600">Create your account</p>
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

        {/* Signup Form */}
        <Card>
          <CardHeader>
            <CardTitle>Get started today</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                name="full_name"
                type="text"
                label="Full Name"
                value={formData.full_name}
                onChange={handleInputChange}
                error={errors.full_name}
                leftIcon={<User className="w-4 h-4" />}
                placeholder="Enter your full name"
                autoComplete="name"
              />

              <Input
                name="username"
                type="text"
                label="Username"
                value={formData.username}
                onChange={handleInputChange}
                error={errors.username}
                leftIcon={<User className="w-4 h-4" />}
                placeholder="Choose a username"
                autoComplete="username"
              />

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
                placeholder="Create a password"
                autoComplete="new-password"
              />

              <Input
                name="confirmPassword"
                type="password"
                label="Confirm Password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                error={errors.confirmPassword}
                leftIcon={<Lock className="w-4 h-4" />}
                placeholder="Confirm your password"
                autoComplete="new-password"
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                isLoading={isSubmitting}
                disabled={connectionStatus !== 'connected'}
              >
                Create Account
              </Button>
            </form>

            {/* Sign In Link */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <Link
                  to="/login"
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            By creating an account, you agree to our Terms of Service
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;