// src/pages/settings/SettingsPage.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card, { CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { 
  Settings,
  User,
  Bell,
  Shield,
  Palette,
  Clock,
  BookOpen,
  Download,
  Trash2,
  Eye,
  EyeOff,
  Moon,
  Sun,
  Monitor,
  Save,
  Camera,
  Lock,
  Mail,
  Smartphone,
  Globe,
  HelpCircle,
  LogOut,
  AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils';

interface SettingsSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  description: string;
}

const settingsSections: SettingsSection[] = [
  {
    id: 'profile',
    title: 'Profile',
    icon: <User className="w-5 h-5" />,
    description: 'Manage your account information and preferences'
  },
  {
    id: 'notifications',
    title: 'Notifications',
    icon: <Bell className="w-5 h-5" />,
    description: 'Configure how you receive updates and reminders'
  },
  {
    id: 'appearance',
    title: 'Appearance',
    icon: <Palette className="w-5 h-5" />,
    description: 'Customize the look and feel of your interface'
  },
  {
    id: 'study',
    title: 'Study Preferences',
    icon: <BookOpen className="w-5 h-5" />,
    description: 'Set your learning goals and session preferences'
  },
  {
    id: 'privacy',
    title: 'Privacy & Security',
    icon: <Shield className="w-5 h-5" />,
    description: 'Control your data privacy and account security'
  },
  {
    id: 'data',
    title: 'Data Management',
    icon: <Download className="w-5 h-5" />,
    description: 'Export your data or manage storage'
  }
];

const SettingsPage: React.FC = () => {
  const { user, logout } = useAuth();
  
  // State management
  const [activeSection, setActiveSection] = useState('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Profile settings
  const [profileData, setProfileData] = useState({
    full_name: user?.full_name || '',
    username: user?.username || '',
    email: user?.email || '',
    bio: '',
    location: '',
    website: ''
  });

  // Notification settings
  const [notificationSettings, setNotificationSettings] = useState({
    email_notifications: true,
    push_notifications: true,
    study_reminders: true,
    achievement_alerts: true,
    weekly_reports: true,
    break_reminders: true,
    goal_deadlines: true
  });

  // Appearance settings
  const [appearanceSettings, setAppearanceSettings] = useState({
    theme: 'system' as 'light' | 'dark' | 'system',
    sidebar_collapsed: false,
    compact_mode: false,
    animations_enabled: true,
    high_contrast: false
  });

  // Study preferences
  const [studySettings, setStudySettings] = useState({
    default_session_duration: 45,
    break_duration: 15,
    long_break_duration: 30,
    sessions_before_long_break: 4,
    auto_start_breaks: false,
    focus_mode: true,
    reading_goal_pages_per_day: 20,
    study_streak_goal: 7,
    preferred_difficulty: 'medium' as 'easy' | 'medium' | 'hard' | 'adaptive'
  });

  // Privacy settings
  const [privacySettings, setPrivacySettings] = useState({
    profile_public: false,
    show_reading_stats: true,
    show_achievements: true,
    data_analytics: true,
    third_party_integrations: false
  });

  // Password change
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  const handleSaveProfile = async () => {
    try {
      setIsSaving(true);
      // Here you would call your API to update the profile
      // await authAPI.updateProfile(profileData);
      toast.success('Profile updated successfully!');
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    try {
      setIsSaving(true);
      // await settingsAPI.updateNotifications(notificationSettings);
      toast.success('Notification preferences saved!');
    } catch (error) {
      toast.error('Failed to save notification preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAppearance = async () => {
    try {
      setIsSaving(true);
      // await settingsAPI.updateAppearance(appearanceSettings);
      toast.success('Appearance settings saved!');
    } catch (error) {
      toast.error('Failed to save appearance settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveStudyPreferences = async () => {
    try {
      setIsSaving(true);
      // await settingsAPI.updateStudyPreferences(studySettings);
      toast.success('Study preferences saved!');
    } catch (error) {
      toast.error('Failed to save study preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePrivacy = async () => {
    try {
      setIsSaving(true);
      // await settingsAPI.updatePrivacy(privacySettings);
      toast.success('Privacy settings saved!');
    } catch (error) {
      toast.error('Failed to save privacy settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error('New passwords do not match');
      return;
    }
    
    if (passwordData.new_password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      setIsSaving(true);
      // await authAPI.changePassword(passwordData);
      toast.success('Password changed successfully!');
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
    } catch (error) {
      toast.error('Failed to change password');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportData = async () => {
    try {
      setIsLoading(true);
      // await dataAPI.exportUserData();
      toast.success('Data export started! You will receive an email when ready.');
    } catch (error) {
      toast.error('Failed to start data export');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmation = window.confirm(
      'Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently lost.'
    );
    
    if (confirmation) {
      const doubleConfirmation = window.prompt(
        'Type "DELETE" to confirm account deletion:'
      );
      
      if (doubleConfirmation === 'DELETE') {
        try {
          setIsLoading(true);
          // await authAPI.deleteAccount();
          toast.success('Account deletion initiated');
          await logout();
        } catch (error) {
          toast.error('Failed to delete account');
        } finally {
          setIsLoading(false);
        }
      }
    }
  };

  const renderProfileSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Profile Information</h3>
        
        {/* Avatar Upload */}
        <div className="flex items-center space-x-6 mb-6">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
            <User className="w-10 h-10 text-blue-600" />
          </div>
          <div>
            <Button variant="outline" leftIcon={<Camera className="w-4 h-4" />}>
              Change Photo
            </Button>
            <p className="text-sm text-gray-500 mt-1">JPG, PNG up to 2MB</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Full Name"
            value={profileData.full_name}
            onChange={(e) => setProfileData(prev => ({ ...prev, full_name: e.target.value }))}
            placeholder="Enter your full name"
          />
          <Input
            label="Username"
            value={profileData.username}
            onChange={(e) => setProfileData(prev => ({ ...prev, username: e.target.value }))}
            placeholder="Enter your username"
          />
          <Input
            label="Email Address"
            type="email"
            value={profileData.email}
            onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
            placeholder="Enter your email"
          />
          <Input
            label="Location"
            value={profileData.location}
            onChange={(e) => setProfileData(prev => ({ ...prev, location: e.target.value }))}
            placeholder="City, Country"
          />
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
          <textarea
            value={profileData.bio}
            onChange={(e) => setProfileData(prev => ({ ...prev, bio: e.target.value }))}
            placeholder="Tell us about yourself..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="mt-6">
          <Button onClick={handleSaveProfile} isLoading={isSaving} leftIcon={<Save className="w-4 h-4" />}>
            Save Profile
          </Button>
        </div>
      </div>

      {/* Password Change Section */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Change Password</h3>
        <div className="space-y-4 max-w-md">
          <div className="relative">
            <Input
              label="Current Password"
              type={showPasswords.current ? "text" : "password"}
              value={passwordData.current_password}
              onChange={(e) => setPasswordData(prev => ({ ...prev, current_password: e.target.value }))}
              placeholder="Enter current password"
            />
            <button
              type="button"
              onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
              className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
            >
              {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          
          <div className="relative">
            <Input
              label="New Password"
              type={showPasswords.new ? "text" : "password"}
              value={passwordData.new_password}
              onChange={(e) => setPasswordData(prev => ({ ...prev, new_password: e.target.value }))}
              placeholder="Enter new password"
            />
            <button
              type="button"
              onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
              className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
            >
              {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          
          <div className="relative">
            <Input
              label="Confirm New Password"
              type={showPasswords.confirm ? "text" : "password"}
              value={passwordData.confirm_password}
              onChange={(e) => setPasswordData(prev => ({ ...prev, confirm_password: e.target.value }))}
              placeholder="Confirm new password"
            />
            <button
              type="button"
              onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
              className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
            >
              {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          
          <Button onClick={handleChangePassword} isLoading={isSaving} leftIcon={<Lock className="w-4 h-4" />}>
            Change Password
          </Button>
        </div>
      </div>
    </div>
  );

  const renderNotificationsSection = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900">Notification Preferences</h3>
      
      <div className="space-y-4">
        {Object.entries(notificationSettings).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between py-3">
            <div>
              <h4 className="font-medium text-gray-900 capitalize">
                {key.replace(/_/g, ' ')}
              </h4>
              <p className="text-sm text-gray-600">
                {key === 'email_notifications' && 'Receive updates via email'}
                {key === 'push_notifications' && 'Browser push notifications'}
                {key === 'study_reminders' && 'Reminders to start study sessions'}
                {key === 'achievement_alerts' && 'Notifications for earned achievements'}
                {key === 'weekly_reports' && 'Weekly progress summary emails'}
                {key === 'break_reminders' && 'Alerts to take breaks during long sessions'}
                {key === 'goal_deadlines' && 'Notifications about approaching deadlines'}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={value}
                onChange={(e) => setNotificationSettings(prev => ({ ...prev, [key]: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        ))}
      </div>

      <div className="pt-4">
        <Button onClick={handleSaveNotifications} isLoading={isSaving} leftIcon={<Save className="w-4 h-4" />}>
          Save Notification Settings
        </Button>
      </div>
    </div>
  );

  const renderAppearanceSection = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900">Appearance Settings</h3>
      
      {/* Theme Selection */}
      <div>
        <h4 className="font-medium text-gray-900 mb-3">Theme</h4>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: 'light', label: 'Light', icon: <Sun className="w-4 h-4" /> },
            { value: 'dark', label: 'Dark', icon: <Moon className="w-4 h-4" /> },
            { value: 'system', label: 'System', icon: <Monitor className="w-4 h-4" /> }
          ].map((theme) => (
            <button
              key={theme.value}
              onClick={() => setAppearanceSettings(prev => ({ ...prev, theme: theme.value as any }))}
              className={cn(
                "flex flex-col items-center p-4 border-2 rounded-lg transition-colors",
                appearanceSettings.theme === theme.value
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              {theme.icon}
              <span className="mt-2 text-sm font-medium">{theme.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Other Appearance Options */}
      <div className="space-y-4">
        {Object.entries(appearanceSettings).filter(([key]) => key !== 'theme').map(([key, value]) => (
          <div key={key} className="flex items-center justify-between py-3">
            <div>
              <h4 className="font-medium text-gray-900 capitalize">
                {key.replace(/_/g, ' ')}
              </h4>
              <p className="text-sm text-gray-600">
                {key === 'sidebar_collapsed' && 'Keep sidebar minimized by default'}
                {key === 'compact_mode' && 'Reduce spacing and padding for more content'}
                {key === 'animations_enabled' && 'Enable smooth transitions and animations'}
                {key === 'high_contrast' && 'Increase contrast for better readability'}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={value as boolean}
                onChange={(e) => setAppearanceSettings(prev => ({ ...prev, [key]: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        ))}
      </div>

      <div className="pt-4">
        <Button onClick={handleSaveAppearance} isLoading={isSaving} leftIcon={<Save className="w-4 h-4" />}>
          Save Appearance Settings
        </Button>
      </div>
    </div>
  );

  const renderStudySection = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900">Study Preferences</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Default Session Duration (minutes)
          </label>
          <input
            type="number"
            min="5"
            max="180"
            value={studySettings.default_session_duration}
            onChange={(e) => setStudySettings(prev => ({ ...prev, default_session_duration: parseInt(e.target.value) }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Break Duration (minutes)
          </label>
          <input
            type="number"
            min="1"
            max="60"
            value={studySettings.break_duration}
            onChange={(e) => setStudySettings(prev => ({ ...prev, break_duration: parseInt(e.target.value) }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Daily Reading Goal (pages)
          </label>
          <input
            type="number"
            min="1"
            max="100"
            value={studySettings.reading_goal_pages_per_day}
            onChange={(e) => setStudySettings(prev => ({ ...prev, reading_goal_pages_per_day: parseInt(e.target.value) }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Preferred Difficulty
          </label>
          <select
            value={studySettings.preferred_difficulty}
            onChange={(e) => setStudySettings(prev => ({ ...prev, preferred_difficulty: e.target.value as any }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
            <option value="adaptive">Adaptive</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {[
          { key: 'auto_start_breaks', label: 'Auto-start breaks', desc: 'Automatically start break timers' },
          { key: 'focus_mode', label: 'Focus mode', desc: 'Hide distracting elements during study sessions' }
        ].map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between py-3">
            <div>
              <h4 className="font-medium text-gray-900">{label}</h4>
              <p className="text-sm text-gray-600">{desc}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={studySettings[key as keyof typeof studySettings] as boolean}
                onChange={(e) => setStudySettings(prev => ({ ...prev, [key]: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        ))}
      </div>

      <div className="pt-4">
        <Button onClick={handleSaveStudyPreferences} isLoading={isSaving} leftIcon={<Save className="w-4 h-4" />}>
          Save Study Preferences
        </Button>
      </div>
    </div>
  );

  const renderPrivacySection = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900">Privacy & Security</h3>
      
      <div className="space-y-4">
        {Object.entries(privacySettings).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between py-3">
            <div>
              <h4 className="font-medium text-gray-900 capitalize">
                {key.replace(/_/g, ' ')}
              </h4>
              <p className="text-sm text-gray-600">
                {key === 'profile_public' && 'Make your profile visible to other users'}
                {key === 'show_reading_stats' && 'Display your reading statistics publicly'}
                {key === 'show_achievements' && 'Show your achievements on your profile'}
                {key === 'data_analytics' && 'Help improve the app with anonymous usage data'}
                {key === 'third_party_integrations' && 'Allow connections to external services'}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={value}
                onChange={(e) => setPrivacySettings(prev => ({ ...prev, [key]: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        ))}
      </div>

      <div className="pt-4">
        <Button onClick={handleSavePrivacy} isLoading={isSaving} leftIcon={<Save className="w-4 h-4" />}>
          Save Privacy Settings
        </Button>
      </div>
    </div>
  );

  const renderDataSection = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900">Data Management</h3>
      
      <div className="space-y-6">
        {/* Export Data */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <Download className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">Export Your Data</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Download a copy of all your study data, including documents, progress, and analytics.
                </p>
                <Button 
                  className="mt-3" 
                  variant="outline" 
                  onClick={handleExportData}
                  isLoading={isLoading}
                  leftIcon={<Download className="w-4 h-4" />}
                >
                  Request Data Export
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delete Account */}
        <Card className="border-red-200">
          <CardContent className="p-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-red-900">Delete Account</h4>
                <p className="text-sm text-red-700 mt-1">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
                <Button 
                  className="mt-3" 
                  variant="destructive" 
                  onClick={handleDeleteAccount}
                  isLoading={isLoading}
                  leftIcon={<Trash2 className="w-4 h-4" />}
                >
                  Delete Account
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'profile':
        return renderProfileSection();
      case 'notifications':
        return renderNotificationsSection();
      case 'appearance':
        return renderAppearanceSection();
      case 'study':
        return renderStudySection();
      case 'privacy':
        return renderPrivacySection();
      case 'data':
        return renderDataSection();
      default:
        return renderProfileSection();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Settings className="w-6 h-6 text-gray-600" />
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Settings</h1>
                  <p className="text-xs text-gray-500">Manage your account and preferences</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:w-64 flex-shrink-0">
            <Card>
              <CardContent className="p-2">
                <nav className="space-y-1">
                  {settingsSections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={cn(
                        'w-full flex items-center space-x-3 px-3 py-2 text-left rounded-lg transition-colors',
                        activeSection === section.id
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      {section.icon}
                      <span className="font-medium">{section.title}</span>
                    </button>
                  ))}
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Content Area */}
          <div className="flex-1">
            <Card>
              <CardContent className="p-6">
                {renderContent()}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;