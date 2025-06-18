// src/components/layout/Header.tsx
import React from 'react';
import { useAuth } from '../../context/AuthContext';
import Button from '../ui/Button';
import { LogOut, User, Bell, Search } from 'lucide-react';
import toast from 'react-hot-toast';

const Header: React.FC = () => {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Logout failed');
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6">
      {/* Left side - could add breadcrumbs or page title here */}
      <div className="flex items-center space-x-4">
        <div className="hidden lg:block">
          {/* Breadcrumbs or page context could go here */}
        </div>
      </div>

      {/* Right side - User menu */}
      <div className="flex items-center space-x-4">
        {/* Search - could be expanded later */}
        <Button variant="ghost" size="sm" className="hidden sm:flex">
          <Search className="w-4 h-4" />
        </Button>

        {/* Notifications - could be expanded later */}
        <Button variant="ghost" size="sm" className="hidden sm:flex">
          <Bell className="w-4 h-4" />
        </Button>

        {/* User Info */}
        <div className="flex items-center space-x-3">
          <div className="hidden sm:block text-right">
            <p className="text-sm font-medium text-gray-900">
              {user?.full_name || user?.username}
            </p>
            <p className="text-xs text-gray-500">
              {user?.email}
            </p>
          </div>

          {/* User Avatar */}
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-blue-600" />
          </div>

          {/* Logout Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-gray-600 hover:text-red-600"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline ml-2">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;