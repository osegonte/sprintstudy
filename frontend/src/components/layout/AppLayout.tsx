// src/components/layout/AppLayout.tsx
import React, { ReactNode } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <Header />
        
        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;

// src/components/layout/Sidebar.tsx
import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  Home, 
  FileText, 
  BookOpen, 
  BarChart3, 
  Settings,
  Menu,
  X
} from 'lucide-react';
import { cn } from '../../lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Documents', href: '/documents', icon: FileText },
  { name: 'Topics', href: '/topics', icon: BookOpen },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

const Sidebar: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const location = useLocation();

  const NavItem: React.FC<{ item: typeof navigation[0] }> = ({ item }) => {
    const isActive = location.pathname === item.href;
    
    return (
      <NavLink
        to={item.href}
        className={cn(
          'group flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200',
          isActive
            ? 'bg-blue-100 text-blue-700 border-r-2 border-blue-600'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        )}
        onClick={() => setIsMobileMenuOpen(false)}
      >
        <item.icon
          className={cn(
            'mr-3 h-5 w-5 transition-colors',
            isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'
          )}
        />
        {item.name}
      </NavLink>
    );
  };

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 rounded-md bg-white shadow-md border border-gray-200 text-gray-600 hover:text-gray-900"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-40 bg-black bg-opacity-50"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0',
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">CineStudy</span>
            </div>
            
            {/* Mobile close button */}
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden p-1 rounded-md text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigation.map((item) => (
              <NavItem key={item.name} item={item} />
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200">
            <div className="text-xs text-gray-500 text-center">
              CineStudy v1.0.0
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;

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